import {
  getMergedCssJs,
  getThemeComponentKey,
} from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import { toEmailPanels } from "../theme-adapter";
import { cssDeclaration, documentPanels } from "./style-adapter";
import { currentTheme, themeComponent } from "./theme-operations";

// Public module 709055 deliberately omits inherited font-size/line-height.
// These properties must remain placeholders and must not expand optional groups.
export function nodeGroupDefaults(editor: Editor, pos: number) {
  const component = themeComponent(editor, pos);
  const merged = getMergedCssJs(
    currentTheme(editor),
    toEmailPanels(documentPanels(editor)),
  );
  const defaults = cssDeclaration("");
  if (!component) return defaults;
  const own = merged[component] ?? {};
  const props = [
    "color",
    "fontWeight",
    "textDecoration",
    "backgroundColor",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "borderStyle",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ];
  for (const side of ["Top", "Right", "Bottom", "Left"])
    props.push(
      `border${side}`,
      `border${side}Width`,
      `border${side}Color`,
      `border${side}Style`,
    );
  for (const prop of props) {
    const value = own[prop as keyof typeof own];
    if (value === undefined) continue;
    const property = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const unit = String(value).match(/^(-?\d*\.?\d+)(em|rem)$/);
    defaults.setProperty(
      property,
      unit ? `${Math.round(Number(unit[1]) * 16)}px` : String(value),
    );
  }
  return defaults;
}

export function blockColorSource(
  editor: Editor,
  pos: number,
): { color: string; pos?: number } {
  const merged = getMergedCssJs(
    currentTheme(editor),
    toEmailPanels(documentPanels(editor)),
  );
  const at = Math.min(Math.max(pos, 0), editor.state.doc.content.size);
  const resolved = editor.state.doc.resolve(at);
  const inspect = (
    node: import("@tiptap/pm/model").Node,
    pos: number,
    depth: number,
  ) => {
    const own = cssDeclaration(node.attrs.style).color;
    if (own) return { color: own, pos };
    const component = getThemeComponentKey(node.type.name, depth, node.attrs);
    const color = component && merged[component]?.color;
    return color ? { color: String(color) } : undefined;
  };
  const node = editor.state.doc.nodeAt(at);
  const own = node && inspect(node, at, 0);
  if (own) return own;
  for (let d = resolved.depth; d > 0; d--) {
    let depth = 0;
    for (let parent = d - 1; parent > 0; parent--)
      if (
        ["bulletList", "orderedList"].includes(resolved.node(parent).type.name)
      )
        depth++;
    const inherited = inspect(resolved.node(d), resolved.before(d), depth);
    if (inherited) return inherited;
  }
  return {
    color: String(merged.container?.color || merged.body?.color || "#000000"),
  };
}
