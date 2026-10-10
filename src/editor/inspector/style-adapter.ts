import { getGlobalContent } from "@react-email/editor/extensions";
import {
  EDITOR_THEMES,
  getMergedCssJs,
  getThemeComponentKey,
} from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { SideValues } from "../controls/SideValuesField";
import { closeEditorHistory } from "../history/history-boundary";
import { toEmailPanels } from "../theme-adapter";
import type { RuntimeThemePanel } from "../types";
import { blockColorSource } from "./node-group-state";
import {
  finishStyleTransaction,
  prepareStyleTransaction,
} from "./style-history";
import { currentTheme, writeGlobalColor } from "./theme-operations";

export function cssDeclaration(raw: unknown) {
  const css = document.createElement("span").style;
  css.cssText = typeof raw === "string" ? raw : "";
  return css;
}
/** Split authored declarations without splitting quoted or nested CSS values. */
function authoredStyleDeclarations(raw: unknown) {
  const source = String(raw ?? "");
  const declarations: string[] = [];
  let start = 0,
    depth = 0,
    quote = "",
    comment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (comment) {
      if (c === "*" && source[i + 1] === "/") {
        comment = false;
        i++;
      }
    } else if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === "/" && source[i + 1] === "*") {
      comment = true;
      i++;
    } else if (c === "'" || c === '"') quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) {
      declarations.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  declarations.push(source.slice(start).trim());
  return declarations.filter(Boolean);
}

/** Remove only operation properties; retain generic list attrs and unknown CSS. */
export function removeAuthoredStyleProperties(
  raw: unknown,
  properties: string[],
) {
  return authoredStyleDeclarations(raw)
    .map((part) => {
      const css = cssDeclaration(part);
      const original = css.cssText;
      for (const prop of properties) css.removeProperty(prop);
      // Parse each declaration separately so unrelated authored bytes, duplicate
      // declarations and properties unknown to this browser survive unchanged.
      return css.cssText === original ? part : css.cssText.replace(/;$/, "");
    })
    .filter(Boolean)
    .map((part) => `${part};`)
    .join(" ");
}

export function selectedBlock(editor: Editor) {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection)
    return { node: selection.node, pos: selection.from };
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).isTextblock)
      return { node: $from.node(depth), pos: $from.before(depth) };
  }
  return null;
}
export function blockStyles(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  const dom = editor.view.nodeDOM(pos);
  const outer = dom instanceof HTMLElement ? dom : null;
  const element = outer?.matches(
    'h1,h2,h3,p,section,a[data-id="react-email-button"],pre,blockquote,ul,ol,li,hr',
  )
    ? outer
    : (outer?.querySelector(
        'h1,h2,h3,p,section,a[data-id="react-email-button"],pre,blockquote,ul,ol,li,hr',
      ) ?? outer);
  return {
    raw: cssDeclaration(node?.attrs.style),
    effective: element ? getComputedStyle(element) : cssDeclaration(""),
  };
}
export function commitNodeStyles(
  editor: Editor,
  pos: number,
  changes: Record<string, string | undefined>,
  expectedNode?: import("@tiptap/pm/model").Node | null,
) {
  const node = editor.state.doc.nodeAt(pos);
  if (expectedNode !== undefined && node !== expectedNode) return;
  if (!node) return;
  const css = cssDeclaration(node.attrs.style);
  // Captured generic list/columns attributes serialize as nonstandard CSS declarations.
  // CSSStyleDeclaration drops these, so retain them across ordinary style edits.
  const genericListStyles = [
    "bulletList",
    "orderedList",
    "twoColumns",
    "threeColumns",
    "fourColumns",
  ].includes(node.type.name)
    ? Array.from(
        String(node.attrs.style ?? "").matchAll(
          /(?:^|;)\s*(tight|start|type|cellspacing)\s*:\s*([^;]*)/g,
        ),
      )
        .filter((match) => !Object.hasOwn(changes, match[1]))
        .map((match) => `${match[1]}:${match[2].trim()}`)
    : [];
  for (const [prop, value] of Object.entries(changes)) {
    if (value === undefined) css.removeProperty(prop);
    else css.setProperty(prop, value);
  }
  // Preserve authored border side/uniform keys: CSSStyleDeclaration.cssText
  // otherwise collapses four equal sides back into a shorthand and loses mode.
  let authoredBorder: string | undefined;
  if (
    Object.keys(changes).some((prop) => prop.startsWith("border")) ||
    /(?:^|;)\s*border(?:-[a-z]+)*\s*:/.test(String(node.attrs.style ?? ""))
  ) {
    const declarations = new Map<string, string>();
    for (const part of authoredStyleDeclarations(node.attrs.style)) {
      const colon = part.indexOf(":");
      if (colon >= 0)
        declarations.set(
          part.slice(0, colon).trim(),
          part.slice(colon + 1).trim(),
        );
    }
    for (const [prop, value] of Object.entries(changes)) {
      if (value === undefined) declarations.delete(prop);
      else declarations.set(prop, value);
    }
    // Source module 473653: clearing width deliberately retains existing style.
    for (const side of ["", "-top", "-right", "-bottom", "-left"]) {
      const width = declarations.get(`border${side}-width`);
      if (
        width &&
        width !== "0" &&
        width !== "0px" &&
        !declarations.get(`border${side}-style`)
      )
        declarations.set(`border${side}-style`, "solid");
    }
    authoredBorder = [...declarations]
      .map(([prop, value]) => `${prop}: ${value};`)
      .join(" ");
  }
  const tr = prepareStyleTransaction(editor, editor.state.tr).setNodeMarkup(
    pos,
    undefined,
    {
      ...node.attrs,
      style: authoredBorder ?? css.cssText + genericListStyles.join(";"),
    },
  );
  if (editor.state.selection instanceof NodeSelection)
    tr.setSelection(NodeSelection.create(tr.doc, pos));
  editor.view.dispatch(tr);
  finishStyleTransaction(editor);
}
export function colorRange(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  if (!empty) return { from, to };
  const block = selectedBlock(editor);
  // Live reference establishes collapsed caret behavior for the core text blocks.
  return block && ["heading", "paragraph"].includes(block.node.type.name)
    ? { from: block.pos + 1, to: block.pos + 1 + block.node.content.size }
    : null;
}
/** Keep unrelated span properties and marks when changing or discarding color. */
export function writeSelectionColor(editor: Editor, color: string | undefined) {
  const { state } = editor;
  const range = colorRange(editor);
  const type = state.schema.marks.preservedStyle;
  const textStyle = state.schema.marks.textStyle;
  if (!range || !type) return;
  const { from, to } = range;
  if (color) {
    let matching = true;
    state.doc.nodesBetween(from, to, (node, at) => {
      if (!node.isTextblock) return;
      if (colorHex(blockColorSource(editor, at).color) !== colorHex(color))
        matching = false;
      return false;
    });
    if (matching) color = undefined;
  }
  const tr = prepareStyleTransaction(editor, state.tr);
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const start = Math.max(from, pos),
      end = Math.min(to, pos + node.nodeSize);
    const old = node.marks.find((mark) => mark.type === type);
    const source = node.marks.find((mark) => mark.type === textStyle);
    if (source) {
      tr.removeMark(start, end, textStyle);
      const attrs = { ...source.attrs, color: color ?? null };
      if (Object.values(attrs).some(Boolean))
        tr.addMark(start, end, textStyle.create(attrs));
    }
    const css = cssDeclaration(old?.attrs.style);
    if (color === undefined || source) css.removeProperty("color");
    else css.setProperty("color", color);
    tr.removeMark(start, end, type);
    if (css.cssText)
      tr.addMark(
        start,
        end,
        type.create({ ...old?.attrs, style: css.cssText }),
      );
  });
  editor.view.dispatch(tr);
  finishStyleTransaction(editor);
}
export function selectionColor(editor: Editor): string | undefined {
  const colors = new Set<string | undefined>();
  const range = colorRange(editor);
  if (!range) return undefined;
  const { from, to } = range;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isText)
      colors.add(
        node.marks.find((m) => m.type.name === "textStyle")?.attrs.color ||
          cssDeclaration(
            node.marks.find((m) => m.type.name === "preservedStyle")?.attrs
              .style,
          ).color ||
          undefined,
      );
  });
  return colors.size === 1 ? [...colors][0] : undefined;
}
/** Convert browser-accepted CSS colors to the picker's sRGB hex model. */
export function colorHex(value: string | undefined): string | undefined {
  if (!value || !CSS.supports("color", value)) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = value;
  const normalized = context.fillStyle;
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(normalized)) return normalized;
  const rgba = normalized.match(
    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/,
  );
  const bytes = rgba
    ? [...rgba.slice(1, 4).map(Number), Math.round(Number(rgba[4] ?? 1) * 255)]
    : (() => {
        // Canvas converts modern CSS color spaces to the picker's sRGB gamut.
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      })();
  return `#${bytes
    .slice(0, bytes[3] === 255 ? 3 : 4)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
export function cssUnit(value: string) {
  return value.match(/^-?(?:\d*\.?\d+)([a-z%]+)$/i)?.[1] ?? "px";
}
export function numeric(value: string | undefined) {
  const parsed = value ? Number.parseFloat(value) : undefined;
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}
export function sides(
  css: CSSStyleDeclaration,
  prefix: "padding" | "margin",
): SideValues {
  return {
    top: numeric(css.getPropertyValue(`${prefix}-top`)),
    right: numeric(css.getPropertyValue(`${prefix}-right`)),
    bottom: numeric(css.getPropertyValue(`${prefix}-bottom`)),
    left: numeric(css.getPropertyValue(`${prefix}-left`)),
  };
}
export function sideChanges(
  value: SideValues,
  prefix: "padding" | "margin",
  raw: CSSStyleDeclaration,
  side?: keyof SideValues,
) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => side === undefined || key === side)
      .map(([key, n]) => {
        const property = `${prefix}-${key}`;
        return [
          property,
          n === undefined
            ? undefined
            : `${n}${side && raw.getPropertyValue(property).endsWith("%") ? "%" : "px"}`,
        ];
      }),
  );
}
export function documentPanels(editor: Editor) {
  return structuredClone(
    getGlobalContent("styles", editor),
  ) as RuntimeThemePanel[];
}
export function documentInput(editor: Editor, component: string, prop: string) {
  return documentPanels(editor)
    .flatMap((panel) => panel.inputs)
    .find((input) => input.classReference === component && input.prop === prop);
}
export function writeDocumentStyles(
  editor: Editor,
  component: string,
  changes: {
    prop: string;
    value: string | number | undefined;
    unit?: string;
  }[],
  panelId?: string,
) {
  if (
    ["body", "container"].includes(component) &&
    changes.length === 1 &&
    changes[0].prop === "color"
  ) {
    writeGlobalColor(
      editor,
      changes[0].value === undefined ? undefined : String(changes[0].value),
    );
    return;
  }
  const panels = documentPanels(editor);
  let panel = panels.find((p) =>
    panelId
      ? p.id === panelId
      : p.classReference === component || p.id === component,
  );
  if (!panel) {
    const defaults = EDITOR_THEMES[currentTheme(editor)] as RuntimeThemePanel[];
    const baseline = defaults.find((p) =>
      panelId
        ? p.id === panelId
        : p.classReference === component || p.id === component,
    );
    if (!baseline) return;
    // Rendering reconstructed groups stays read-only. The first explicit edit
    // creates only its panel metadata and authored inputs, not inherited values.
    panel = { ...structuredClone(baseline), inputs: [] };
    const at = panels.findIndex(
      (p) =>
        defaults.findIndex((d) => d.id === p.id) > defaults.indexOf(baseline),
    );
    if (at < 0) panels.push(panel);
    else panels.splice(at, 0, panel);
  }
  for (const change of changes) {
    const existing = (
      panelId ? panel.inputs : panels.flatMap((p) => p.inputs)
    ).find((i) => i.classReference === component && i.prop === change.prop);
    if (existing) {
      if (change.value === undefined) delete existing.value;
      else existing.value = change.value;
      if (change.unit) existing.unit = change.unit;
    } else
      panel.inputs.push({
        label: change.prop,
        type: typeof change.value === "number" ? "number" : "text",
        classReference: component,
        prop: change.prop,
        ...(change.value === undefined ? {} : { value: change.value }),
        ...(change.unit === undefined ? {} : { unit: change.unit }),
      });
  }
  // Public setGlobalStyles delegates to this same command. Chaining lets us
  // attach the gesture metadata before history applies the theme transaction.
  editor
    .chain()
    .command(({ tr }) => {
      prepareStyleTransaction(editor, tr);
      return true;
    })
    .setGlobalContent("styles", toEmailPanels(panels))
    .run();
  finishStyleTransaction(editor);
}

const discardProperties = [
  "color",
  "font-weight",
  "font-size",
  "line-height",
  "letter-spacing",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-radius",
  "border-width",
  "background-color",
  "border-color",
  "border-style",
];
function textOverrides(editor: Editor) {
  const block = selectedBlock(editor);
  if (!block) return null;
  const css = cssDeclaration(block.node.attrs.style);
  const properties = discardProperties.filter((prop) =>
    css.getPropertyValue(prop),
  );
  const leaves: import("@tiptap/pm/model").Node[] = [];
  block.node.descendants((node) => {
    if (node.isText) leaves.push(node);
  });
  const all = (mark: string) =>
    leaves.length > 0 &&
    leaves.every((node) => node.marks.some((m) => m.type.name === mark));
  const color = leaves.some((node) =>
    node.marks.some(
      (m) =>
        (m.type.name === "textStyle" && m.attrs.color) ||
        (m.type.name === "preservedStyle" &&
          cssDeclaration(m.attrs.style).color),
    ),
  );
  const underline = all("underline"),
    strike = all("strike");
  // Source tM prefers a recognized node declaration, otherwise exactly one
  // uniform decoration. t_ clears only the mark named by that effective change.
  const decoration =
    css.textDecoration === "underline" || css.textDecoration === "line-through"
      ? css.textDecoration
      : underline !== strike
        ? underline
          ? "underline"
          : "line-through"
        : undefined;
  if (decoration) properties.push("text-decoration");
  return { block, css, properties, color, bold: all("bold"), decoration };
}
/** The source removes supported overrides across the node while preserving link/italic/code. */
export function canDiscardText(editor: Editor) {
  const overrides = textOverrides(editor);
  return (
    !!overrides &&
    !!(
      overrides.properties.length ||
      overrides.color ||
      overrides.bold ||
      overrides.decoration
    )
  );
}
export function discardTextFormatting(editor: Editor) {
  const overrides = textOverrides(editor);
  if (!overrides || !canDiscardText(editor)) return;
  const { block, css, properties } = overrides;
  const from = block.pos + 1,
    to = from + block.node.content.size;
  const tr = closeEditorHistory(editor.state.tr);
  for (const property of properties) css.removeProperty(property);
  tr.setNodeMarkup(block.pos, undefined, {
    ...block.node.attrs,
    style: css.cssText,
  });
  if (overrides.bold) tr.removeMark(from, to, editor.schema.marks.bold);
  if (overrides.decoration)
    tr.removeMark(
      from,
      to,
      editor.schema.marks[
        overrides.decoration === "underline" ? "underline" : "strike"
      ],
    );
  if (overrides.color || properties.includes("color"))
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;
      for (const mark of node.marks) {
        if (mark.type.name === "textStyle") {
          const attrs = { ...mark.attrs, color: null };
          tr.removeMark(pos, pos + node.nodeSize, mark.type);
          if (Object.values(attrs).some(Boolean))
            tr.addMark(pos, pos + node.nodeSize, mark.type.create(attrs));
        } else if (mark.type.name === "preservedStyle") {
          const style = cssDeclaration(mark.attrs.style);
          style.removeProperty("color");
          tr.removeMark(pos, pos + node.nodeSize, mark.type);
          if (style.cssText)
            tr.addMark(
              pos,
              pos + node.nodeSize,
              mark.type.create({ ...mark.attrs, style: style.cssText }),
            );
        }
      }
    });
  editor.view.dispatch(tr);
  editor.view.dispatch(closeEditorHistory(editor.state.tr));
}
export function documentColors(editor: Editor) {
  const colors = new Set<string>();
  for (const panel of documentPanels(editor))
    for (const input of panel.inputs) {
      if (
        input.type === "color" &&
        typeof input.value === "string" &&
        input.value
      )
        colors.add(input.value);
    }
  editor.state.doc.descendants((node) => {
    for (const mark of node.marks)
      if (mark.type.name === "textStyle" && mark.attrs.color)
        colors.add(colorHex(mark.attrs.color) ?? mark.attrs.color);
    for (const style of [
      node.attrs.style,
      ...node.marks.map((mark) => mark.attrs.style),
    ]) {
      const css = cssDeclaration(style);
      for (const value of [css.color, css.backgroundColor, css.borderColor])
        if (value) colors.add(colorHex(value) ?? value);
    }
  });
  return [...colors];
}

/** Display calibration for the directly observed, unmodified Basic baseline only.
 * Explicit declarations and unknown theme/ancestor/CSS sources keep computed display.
 * This never changes node CSS, document styles, or email serialization.
 */
export function inheritedSides(
  editor: Editor,
  pos: number,
  prefix: "padding" | "margin",
  effective: CSSStyleDeclaration,
): SideValues {
  const computed = sides(effective, prefix);
  if (
    prefix !== "padding" ||
    getGlobalContent("theme", editor) !== "basic" ||
    getGlobalContent("css", editor)
  )
    return computed;
  const node = editor.state.doc.nodeAt(pos);
  if (
    !node ||
    ![
      "heading",
      "paragraph",
      "blockquote",
      "bulletList",
      "orderedList",
      "horizontalRule",
      "button",
      "codeBlock",
    ].includes(node.type.name)
  )
    return computed;
  const resolved = editor.state.doc.resolve(pos);
  const ancestors = Array.from({ length: resolved.depth }, (_, i) =>
    resolved.node(i + 1),
  );
  if (
    [node, ...ancestors].some(
      (n) =>
        n.attrs.style ||
        (n.attrs.class &&
          !(
            n === node &&
            ((n.type.name === "button" && n.attrs.class === "button") ||
              (n.type.name === "horizontalRule" && n.attrs.class === "divider"))
          )),
    )
  )
    return computed;
  const merged = getMergedCssJs("basic", toEmailPanels(documentPanels(editor)));
  const baseline = getMergedCssJs("basic", EDITOR_THEMES.basic);
  // Until override and mixed-source routing is observed, use the actual CSS.
  if (JSON.stringify(merged) !== JSON.stringify(baseline)) return computed;
  const key = getThemeComponentKey(node.type.name, 0, node.attrs);
  if (!key) return computed;
  const defaults = {
    ...(["bulletList", "orderedList"].includes(node.type.name)
      ? merged.list
      : {}),
    ...merged[key],
  };
  return Object.fromEntries(
    Object.entries(computed).map(([side, value]) => {
      const property = `padding${side[0].toUpperCase()}${side.slice(1)}`;
      const raw = defaults?.[property as keyof typeof defaults];
      const match =
        typeof raw === "string" ? raw.match(/^([\d.]+)(?:em|rem)$/) : null;
      return [side, match ? Math.round(Number(match[1]) * 16) : value];
    }),
  ) as SideValues;
}
