import {
  Blockquote,
  BulletList,
  ListItem,
  OrderedList,
} from "@react-email/editor/extensions";
import type { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  type BlockTarget,
  canConvertTextTarget,
  dispatchBlockTransaction,
  resolveBlock,
  resolveBlockTarget,
} from "./commands";

export const textFamilyExtensions = {
  bulletList: BulletList.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        tight: {
          default: true,
          renderHTML: (attrs) => ({
            "data-tight": String(attrs.tight),
            class: attrs.tight ? "tight" : "",
          }),
        },
      };
    },
  }).configure({ HTMLAttributes: { class: "node-list node-bulletList" } }),
  orderedList: OrderedList.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        tight: {
          default: true,
          renderHTML: (attrs) => ({
            "data-tight": String(attrs.tight),
            class: attrs.tight ? "tight" : "",
          }),
        },
      };
    },
  }).configure({ HTMLAttributes: { class: "node-list node-orderedList" } }),
  listItem: ListItem.configure({ HTMLAttributes: { class: "node-listItem" } }),
  blockquote: Blockquote.configure({
    HTMLAttributes: { class: "node-blockquote" },
  }),
};
/** Palette list rebuilds its paragraph; Code retains block attrs and strips inline marks. */
export function convertTextFamily(
  editor: Editor,
  kind: "bulletList" | "orderedList" | "blockquote" | "codeBlock",
  target: BlockTarget | null = resolveBlockTarget(editor),
) {
  if (!target) return false;
  const r = resolveBlock(editor, target);
  if (!r?.node.isTextblock) return false;
  const { schema } = editor.state;
  if (kind === "blockquote" && r.parent.type.name === "blockquote") {
    if (r.parent.childCount !== 1) return false;
    const quotePos = r.$pos.before(r.$pos.depth);
    const $quote = editor.state.doc.resolve(quotePos);
    if (
      !$quote.parent.canReplace(
        $quote.index(),
        $quote.index() + 1,
        r.parent.content,
      )
    )
      return false;
    const tr = editor.state.tr.replaceWith(
      quotePos,
      quotePos + r.parent.nodeSize,
      r.parent.content,
    );
    tr.setSelection(TextSelection.create(tr.doc, quotePos + 1));
    return dispatchBlockTransaction(editor, tr);
  }
  const node =
    kind === "blockquote"
      ? schema.nodes.blockquote.createChecked(null, r.node)
      : kind === "codeBlock"
        ? schema.nodes.codeBlock.createChecked(
            { ...r.node.attrs, language: "javascript", theme: "default" },
            r.node.textContent ? schema.text(r.node.textContent) : undefined,
          )
        : schema.nodes[kind].createChecked(
            null,
            schema.nodes.listItem.createChecked(
              null,
              schema.nodes.paragraph.createChecked(null, r.node.content),
            ),
          );
  if (!r.parent.canReplace(r.index, r.index + 1, Fragment.from(node)))
    return false;
  const tr = editor.state.tr.replaceWith(
    target.pos,
    target.pos + r.node.nodeSize,
    node,
  );
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      target.pos + (kind === "blockquote" ? 2 : kind === "codeBlock" ? 1 : 3),
    ),
  );
  return dispatchBlockTransaction(editor, tr);
}

export function canTurnIntoTextFamily(editor: Editor, target: BlockTarget) {
  // Captured Turn into resets block styles while preserving inline content/marks.
  return canConvertTextTarget(editor, target);
}

export function turnIntoTextFamily(
  editor: Editor,
  target: BlockTarget,
  kind: "paragraph" | "heading" | "bulletList" | "orderedList" | "blockquote",
  level?: number,
) {
  if (!canTurnIntoTextFamily(editor, target)) return false;
  const r = resolveBlock(editor, target);
  if (!r) return false;
  const schema = editor.schema;
  const paragraph = schema.nodes.paragraph.createChecked(null, r.node.content);
  const node =
    kind === "paragraph"
      ? paragraph
      : kind === "heading"
        ? schema.nodes.heading.createChecked({ level }, r.node.content)
        : kind === "blockquote"
          ? schema.nodes.blockquote.createChecked(null, paragraph)
          : schema.nodes[kind].createChecked(
              null,
              schema.nodes.listItem.createChecked(null, paragraph),
            );
  if (!r.parent.canReplace(r.index, r.index + 1, Fragment.from(node)))
    return false;
  const tr = editor.state.tr.replaceWith(
    target.pos,
    target.pos + r.node.nodeSize,
    node,
  );
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      target.pos +
        (kind === "blockquote"
          ? 2
          : kind === "bulletList" || kind === "orderedList"
            ? 3
            : 1),
    ),
  );
  return dispatchBlockTransaction(editor, tr);
}
