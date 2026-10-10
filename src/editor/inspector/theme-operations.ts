import { getGlobalContent } from "@react-email/editor/extensions";
import {
  EDITOR_THEMES,
  getMergedCssJs,
  getThemeBodyFontSizePx,
  getThemeComponentKey,
  SUPPORTED_CSS_PROPERTIES,
} from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { getEditorSessionRevision } from "../blocks/commands";
import { closeEditorHistory } from "../history/history-boundary";
import type { RuntimeThemePanel } from "../types";
import {
  cssDeclaration,
  documentPanels,
  removeAuthoredStyleProperties,
} from "./style-adapter";
import {
  finishStyleTransaction,
  prepareStyleTransaction,
} from "./style-history";

export type ThemeChange = {
  classReference: string;
  prop: string;
  newValue: string | number;
};
export function currentTheme(editor: Editor): "basic" | "minimal" {
  return getGlobalContent("theme", editor) === "minimal" ? "minimal" : "basic";
}
/** Source module 496769: change an existing input, or insert using its theme/property definition. */
export function applyThemeChange(
  panels: RuntimeThemePanel[],
  theme: "basic" | "minimal",
  change: ThemeChange,
): RuntimeThemePanel[] {
  const { classReference, prop, newValue } = change;
  let found = false;
  const changed = panels.map((panel) => ({
    ...panel,
    inputs: panel.inputs.map((input) => {
      if (input.classReference !== classReference || input.prop !== prop)
        return input;
      found = true;
      return { ...input, value: newValue };
    }),
  }));
  if (found) return changed;
  const defaults = EDITOR_THEMES[theme] as RuntimeThemePanel[];
  const baseline = defaults.find(
    (panel) => panel.classReference === classReference,
  );
  const existing = panels.find(
    (panel) => panel.classReference === classReference,
  );
  const definition = baseline?.inputs.find(
    (input) => input.classReference === classReference && input.prop === prop,
  );
  const supported =
    SUPPORTED_CSS_PROPERTIES[prop as keyof typeof SUPPORTED_CSS_PROPERTIES];
  if ((!baseline && !existing) || (!definition && !supported)) return panels;
  const input = definition
    ? { ...definition, value: newValue }
    : {
        label: supported.label,
        type: supported.type,
        prop,
        classReference,
        value: newValue,
        ...("unit" in supported ? { unit: supported.unit } : {}),
        ...("options" in supported ? { options: supported.options } : {}),
      };
  if (existing)
    return panels.map((panel) =>
      panel === existing
        ? { ...panel, inputs: [...panel.inputs, input] }
        : panel,
    ) as RuntimeThemePanel[];
  if (!baseline) return panels;
  const panel = {
    ...baseline,
    inputs: definition
      ? baseline.inputs.map((item) =>
          item.classReference === classReference && item.prop === prop
            ? input
            : item,
        )
      : [...baseline.inputs, input],
  };
  const at = panels.findIndex(
    (p) =>
      defaults.findIndex((d) => d.id === p.id) > defaults.indexOf(baseline),
  );
  return at < 0
    ? ([...panels, panel] as RuntimeThemePanel[])
    : ([
        ...panels.slice(0, at),
        panel,
        ...panels.slice(at),
      ] as RuntimeThemePanel[]);
}
export function themeGroupDirty(
  panels: RuntimeThemePanel[],
  theme: "basic" | "minimal",
  id: string,
) {
  const panel = panels.find((p) => p.id === id),
    baseline = EDITOR_THEMES[theme].find((p) => p.id === id);
  if (!panel || !baseline) return false;
  const changed = panel.inputs.some((input) => {
    const original = baseline.inputs.find(
      (i) => i.classReference === input.classReference && i.prop === input.prop,
    );
    return (
      !original || String(input.value ?? "") !== String(original.value ?? "")
    );
  });
  if (changed || id !== "typography") return changed;
  const originals = EDITOR_THEMES[theme].flatMap((p) => p.inputs);
  return panels
    .flatMap((p) => p.inputs)
    .some(
      (input) =>
        input.prop === "color" &&
        ["body", "container"].includes(input.classReference) &&
        String(input.value ?? "") !==
          String(
            originals.find(
              (i) =>
                i.classReference === input.classReference && i.prop === "color",
            )?.value ?? "",
          ),
    );
}
export function resetThemeGroup(
  panels: RuntimeThemePanel[],
  theme: "basic" | "minimal",
  id: string,
): RuntimeThemePanel[] {
  const baseline = EDITOR_THEMES[theme].find((p) => p.id === id);
  const panel = panels.find((p) => p.id === id);
  if (!baseline || !panel) return panels;
  const globalColor = (i: RuntimeThemePanel["inputs"][number]) =>
    i.prop === "color" && ["body", "container"].includes(i.classReference);
  const resetColors = id === "typography" || panel.inputs.some(globalColor);
  return panels.map((p) => {
    if (p.id === id) return structuredClone(baseline) as RuntimeThemePanel;
    if (!resetColors) return p;
    const original = EDITOR_THEMES[theme].find((o) => o.id === p.id);
    return {
      ...p,
      inputs: p.inputs.flatMap((i) => {
        if (!globalColor(i)) return [i];
        const match = original?.inputs.find(
          (o) => o.prop === "color" && o.classReference === i.classReference,
        );
        return match ? [{ ...i, value: match.value }] : [];
      }),
    };
  });
}
export function themeComponent(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return null;
  const resolved = editor.state.doc.resolve(pos);
  let depth = 0;
  for (let d = resolved.depth; d > 0; d--)
    if (["bulletList", "orderedList"].includes(resolved.node(d).type.name))
      depth++;
  return getThemeComponentKey(node.type.name, depth, node.attrs);
}
const kebab = (prop: string) =>
  prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const numericProps = [
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderRadius",
  "borderWidth",
];
function leaves(node: Node) {
  const result: Node[] = [];
  node.descendants((n) => {
    if (n.isText) result.push(n);
  });
  return result;
}
function uniformMarkColor(node: Node) {
  const nodes = leaves(node),
    colors = nodes.map(
      (n) =>
        n.marks.find((m) => m.type.name === "textStyle")?.attrs.color ||
        cssDeclaration(
          n.marks.find((m) => m.type.name === "preservedStyle")?.attrs.style,
        ).color ||
        undefined,
    );
  return nodes.length && colors.every((c) => c && c === colors[0])
    ? (colors[0] as string)
    : undefined;
}
export function nodeThemeChanges(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos),
    component = themeComponent(editor, pos);
  if (!node || !component)
    return { changes: [] as ThemeChange[], promotable: [] as ThemeChange[] };
  const raw = cssDeclaration(node.attrs.style),
    changes: ThemeChange[] = [],
    promotable: ThemeChange[] = [];
  const add = (prop: string, newValue: string | number, promote = true) => {
    const supported =
      SUPPORTED_CSS_PROPERTIES[prop as keyof typeof SUPPORTED_CSS_PROPERTIES];
    if (
      supported &&
      "excludeNodes" in supported &&
      (supported.excludeNodes as readonly string[]).includes(node.type.name)
    )
      return;
    const change = { classReference: component, prop, newValue };
    changes.push(change);
    if (promote) promotable.push(change);
  };
  const all = (mark: string) => {
    const nodes = leaves(node);
    return (
      nodes.length > 0 &&
      nodes.every((n) => n.marks.some((m) => m.type.name === mark))
    );
  };
  if (node.isTextblock) {
    const color = raw.color || uniformMarkColor(node);
    if (color) add("color", color);
    else if (
      leaves(node).some((n) =>
        n.marks.some(
          (m) =>
            (m.type.name === "textStyle" && m.attrs.color) ||
            (m.type.name === "preservedStyle" &&
              cssDeclaration(m.attrs.style).color),
        ),
      )
    )
      add("color", "", false);
    const weight = raw.fontWeight
      ? ({ normal: 400, bold: 700 }[raw.fontWeight] ?? Number(raw.fontWeight))
      : all("bold")
        ? 700
        : undefined;
    if (weight !== undefined) add("fontWeight", weight);
    const decoration = ["underline", "line-through"].includes(
      raw.textDecoration,
    )
      ? raw.textDecoration
      : all("underline") !== all("strike")
        ? all("underline")
          ? "underline"
          : "line-through"
        : undefined;
    if (decoration) add("textDecoration", decoration);
  }
  for (const prop of numericProps) {
    if (
      !node.isTextblock &&
      ["fontSize", "lineHeight", "letterSpacing"].includes(prop)
    )
      continue;
    const value = raw.getPropertyValue(kebab(prop));
    if (!value) continue;
    const match = value.match(/^(-?\d*\.?\d+)(px|%|em|rem)?$/);
    const n = match ? Number(match[1]) : undefined,
      unit = match?.[2] ?? "";
    const scalar =
      n === undefined
        ? undefined
        : prop === "lineHeight"
          ? unit === "%"
            ? n
            : ["", "em", "rem"].includes(unit)
              ? Math.round(n * 100)
              : undefined
          : ["em", "rem"].includes(unit)
            ? prop === "fontSize"
              ? Math.round(n * getThemeBodyFontSizePx(currentTheme(editor)))
              : undefined
            : ["px", ""].includes(unit)
              ? n
              : undefined;
    add(prop, scalar ?? value, scalar !== undefined);
  }
  for (const prop of ["backgroundColor", "borderColor", "borderStyle"]) {
    const value = raw.getPropertyValue(kebab(prop));
    if (value) add(prop, value);
  }
  return { changes, promotable };
}
/** Whole-node removal is one transaction; preserve unrelated italic, link, code and selection. */
export function applyNodeThemeOperation(
  editor: Editor,
  pos: number,
  promote: boolean,
  revision = getEditorSessionRevision(editor),
) {
  if (revision !== getEditorSessionRevision(editor)) return false;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  const info = nodeThemeChanges(editor, pos);
  let panels = documentPanels(editor);
  const changes = promote
    ? info.promotable.filter((change) => {
        const next = applyThemeChange(panels, currentTheme(editor), change);
        if (next === panels) return false;
        panels = next;
        return true;
      })
    : info.changes;
  if (!changes.length) return false;
  const style = removeAuthoredStyleProperties(
    node.attrs.style,
    changes.map(({ prop }) => kebab(prop)),
  );
  const tr = closeEditorHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
    ...node.attrs,
    style,
  });
  const color = changes.find((c) => c.prop === "color");
  const clearColor =
    color && (!promote || uniformMarkColor(node) === color.newValue);
  node.descendants((child, offset) => {
    if (!child.isText) return;
    const from = pos + 1 + offset,
      to = from + child.nodeSize;
    for (const mark of child.marks) {
      if (
        (mark.type.name === "bold" &&
          changes.some(
            (c) => c.prop === "fontWeight" && (!promote || c.newValue === 700),
          )) ||
        (mark.type.name === "underline" &&
          changes.some(
            (c) => c.prop === "textDecoration" && c.newValue === "underline",
          )) ||
        (mark.type.name === "strike" &&
          changes.some(
            (c) => c.prop === "textDecoration" && c.newValue === "line-through",
          ))
      )
        tr.removeMark(from, to, mark.type);
      if (clearColor && mark.type.name === "textStyle") {
        tr.removeMark(from, to, mark.type);
        const attrs = { ...mark.attrs, color: null };
        if (
          Object.values(attrs).some(
            (v) => v !== null && v !== undefined && v !== "",
          )
        )
          tr.addMark(from, to, mark.type.create(attrs));
      }
      if (clearColor && mark.type.name === "preservedStyle") {
        const style = cssDeclaration(mark.attrs.style);
        style.removeProperty("color");
        tr.removeMark(from, to, mark.type);
        if (style.cssText)
          tr.addMark(
            from,
            to,
            mark.type.create({ ...mark.attrs, style: style.cssText }),
          );
      }
    }
  });
  if (promote)
    tr.doc.descendants((n, at) => {
      if (n.type.name === "globalContent")
        tr.setNodeMarkup(at, undefined, {
          ...n.attrs,
          data: { ...n.attrs.data, styles: panels },
        });
    });
  editor.view.dispatch(tr);
  editor.view.dispatch(closeEditorHistory(editor.state.tr));
  return true;
}

/** Source 828454 skips Button/Quote subtrees and link/code text when sweeping a global color. */
export function sweepMatchingColor(
  tr: import("@tiptap/pm/state").Transaction,
  oldColor: string,
) {
  const normalized = cssDeclaration(`color:${oldColor}`).color;
  tr.doc.descendants((node, pos) => {
    if (["button", "blockquote"].includes(node.type.name)) return false;
    if (node.isText) {
      if (node.marks.some((m) => ["link", "code"].includes(m.type.name)))
        return;
      for (const mark of node.marks) {
        if (
          mark.type.name === "textStyle" &&
          mark.attrs.color &&
          cssDeclaration(`color:${mark.attrs.color}`).color === normalized
        ) {
          tr.removeMark(pos, pos + node.nodeSize, mark);
          const attrs = { ...mark.attrs, color: null };
          if (
            Object.entries(attrs).some(
              ([key, value]) =>
                key !== "color" &&
                value !== null &&
                value !== undefined &&
                value !== "",
            )
          )
            tr.addMark(pos, pos + node.nodeSize, mark.type.create(attrs));
        }
      }
      return;
    }
    const raw = cssDeclaration(node.attrs.style);
    if (raw.color && raw.color === normalized) {
      raw.removeProperty("color");
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: raw.cssText });
    }
  });
}
export function selectTheme(editor: Editor, next: "basic" | "minimal") {
  const prior = getMergedCssJs(
    currentTheme(editor),
    documentPanels(editor) as Parameters<typeof getMergedCssJs>[1],
  );
  const following = getMergedCssJs(next, EDITOR_THEMES[next]);
  const oldColor = prior.container?.color || prior.body?.color;
  const newColor = following.container?.color || following.body?.color;
  editor
    .chain()
    .setGlobalContent("theme", next)
    .setGlobalContent("styles", structuredClone(EDITOR_THEMES[next]))
    .command(({ tr }) => {
      // Captured source Minimal selection is outside editor Undo; preceding text remains undoable.
      tr.setMeta("addToHistory", false);
      if (oldColor && oldColor !== newColor)
        sweepMatchingColor(tr, String(oldColor));
      return true;
    })
    .run();
}

const colorAnchors = new WeakMap<
  Editor,
  { color: string | undefined; at: number }
>();
const redundantComponents = new Set([
  "h1",
  "h2",
  "h3",
  "paragraph",
  "list",
  "nestedList",
  "listItem",
]);
function globalColor(editor: Editor, panels = documentPanels(editor)) {
  const css = getMergedCssJs(
    currentTheme(editor),
    panels as Parameters<typeof getMergedCssJs>[1],
  );
  return String(css.container?.color || css.body?.color || "") || undefined;
}
function equalColors(a: string, b: string) {
  return (
    cssDeclaration(`color:${a}`).color === cssDeclaration(`color:${b}`).color
  );
}
function withoutRedundantColors(panels: RuntimeThemePanel[], color: string) {
  return panels.map((panel) => ({
    ...panel,
    inputs: panel.inputs.filter(
      (input) =>
        !(
          input.prop === "color" &&
          redundantComponents.has(
            input.classReference ?? panel.classReference ?? "",
          ) &&
          typeof input.value === "string" &&
          equalColors(input.value, color)
        ),
    ),
  }));
}
function commitThemePanels(
  editor: Editor,
  panels: RuntimeThemePanel[],
  sweep?: string,
) {
  editor
    .chain()
    .command(({ tr }) => {
      prepareStyleTransaction(editor, tr);
      return true;
    })
    .setGlobalContent("styles", panels as Parameters<typeof getMergedCssJs>[1])
    .command(({ tr }) => {
      if (sweep) sweepMatchingColor(tr, sweep);
      return true;
    })
    .run();
  finishStyleTransaction(editor);
}
export function writeGlobalColor(editor: Editor, value: string | undefined) {
  const now = Date.now(),
    previous = colorAnchors.get(editor);
  const anchor =
    previous && now - previous.at <= 800 ? previous.color : globalColor(editor);
  colorAnchors.set(editor, { color: anchor, at: now });
  let panels = documentPanels(editor);
  for (const classReference of ["body", "container"])
    panels = applyThemeChange(panels, currentTheme(editor), {
      classReference,
      prop: "color",
      newValue: value ?? "",
    });
  const sweep =
    anchor && value && !equalColors(anchor, value) ? anchor : undefined;
  if (sweep) panels = withoutRedundantColors(panels, sweep);
  commitThemePanels(editor, panels, sweep);
}
export function resetEditorThemeGroup(editor: Editor, id: string) {
  const panels = documentPanels(editor),
    oldColor = globalColor(editor, panels);
  let next = resetThemeGroup(panels, currentTheme(editor), id);
  const color = globalColor(editor, next);
  const sweep =
    oldColor && color && !equalColors(oldColor, color) ? oldColor : undefined;
  if (sweep) next = withoutRedundantColors(next, sweep);
  commitThemePanels(editor, next, sweep);
}

/** Source InspectorGlobal merges missing controls for rendering, without persisting fallbacks. */
export function themeRenderPanels(
  panels: RuntimeThemePanel[],
  theme: "basic" | "minimal",
) {
  const defaults = EDITOR_THEMES[theme] as RuntimeThemePanel[];
  const displayInput = (input: RuntimeThemePanel["inputs"][number]) => {
    if (input.classReference === "container" && input.prop === "align")
      return { ...input, value: "center" };
    const definition =
      SUPPORTED_CSS_PROPERTIES[
        input.prop as keyof typeof SUPPORTED_CSS_PROPERTIES
      ];
    return definition?.type === "number"
      ? { ...input, value: "", placeholder: String(definition.defaultValue) }
      : { ...input };
  };
  const result = panels.map((panel) => {
    const original = defaults.find((base) =>
      panel.id ? panel.id === base.id : panel.title === base.title,
    );
    if (!original || original.inputs.length === 0) return panel;
    const keys = new Set(
      panel.inputs.map((input) => `${input.classReference}:${input.prop}`),
    );
    return {
      ...panel,
      inputs: [
        ...panel.inputs,
        ...original.inputs
          .filter((input) => !keys.has(`${input.classReference}:${input.prop}`))
          .map(displayInput),
      ],
    };
  });
  for (const original of defaults) {
    if (
      result.some((panel) =>
        original.id ? original.id === panel.id : original.title === panel.title,
      )
    )
      continue;
    const at = result.findIndex(
      (panel) =>
        defaults.findIndex((base) => base.id === panel.id) >
        defaults.indexOf(original),
    );
    const panel = { ...original, inputs: original.inputs.map(displayInput) };
    if (at < 0) result.push(panel);
    else result.splice(at, 0, panel);
  }
  return result;
}
