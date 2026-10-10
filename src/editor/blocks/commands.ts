import { type Editor, Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { createDocumentContract, validateDocument } from "../document-contract";
import { closeEditorHistory } from "../history/history-boundary";

export type CoreBlockKind = "paragraph" | "heading" | "section";
export type BlockKind =
  | "twoColumns"
  | "threeColumns"
  | "fourColumns"
  | "columnsColumn"
  | "dataTable"
  | "dataTableRow"
  | "dataTableCell"
  | CoreBlockKind
  | "button"
  | "horizontalRule"
  | "bulletList"
  | "orderedList"
  | "listItem"
  | "blockquote"
  | "codeBlock"
  | "htmlContent"
  | "footer"
  | "socialLinks"
  | "youtube"
  | "twitter"
  | "image"
  | "ogLinkPreview";
export type BlockTarget = { pos: number; nodeType: string; revision: number };
/** Compatibility only: old callers obtain their position immediately before an action. */
export type LegacyBlockTarget = {
  pos: number;
  type: BlockKind;
  revision?: number;
};
type Target = BlockTarget | LegacyBlockTarget;
export type BlockAction = "moveUp" | "moveDown" | "duplicate" | "delete";
const revisionKey = new PluginKey<number>("blockSessionRevision");
export const createBlockRevisionPlugin = () =>
  new Plugin({
    key: revisionKey,
    state: {
      init: () => 0,
      apply: (transaction, revision) =>
        revision + (transaction.docChanged ? 1 : 0),
    },
  });
export const BlockSessionRevision = Extension.create({
  name: "blockSessionRevision",
  addProseMirrorPlugins: () => [createBlockRevisionPlugin()],
});
export function getEditorSessionRevision(editor: Editor): number {
  return revisionKey.getState(editor.state) ?? 0;
}
export function isCoreBlock(type: string): type is BlockKind {
  return [
    "twoColumns",
    "threeColumns",
    "fourColumns",
    "columnsColumn",
    "dataTable",
    "dataTableRow",
    "dataTableCell",
    "paragraph",
    "heading",
    "section",
    "button",
    "horizontalRule",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "codeBlock",
    "htmlContent",
    "footer",
    "socialLinks",
    "youtube",
    "twitter",
    "image",
    "ogLinkPreview",
  ].includes(type);
}
export function resolveBlockTarget(
  editor: Editor,
  pos?: number,
): BlockTarget | null {
  if (pos === undefined) {
    const selected = selectedCoreBlock(editor);
    return selected
      ? {
          pos: selected.pos,
          nodeType: selected.type,
          revision: getEditorSessionRevision(editor),
        }
      : null;
  }
  if (!Number.isInteger(pos) || pos < 0 || pos >= editor.state.doc.content.size)
    return null;
  const node = editor.state.doc.nodeAt(pos);
  if (!node || !isCoreBlock(node.type.name)) return null;
  const target = {
    pos,
    nodeType: node.type.name,
    revision: getEditorSessionRevision(editor),
  };
  return resolveBlock(editor, target) ? target : null;
}
export function resolveBlock(editor: Editor, target: Target) {
  const { doc } = editor.state;
  if (
    target.revision !== undefined &&
    target.revision !== getEditorSessionRevision(editor)
  )
    return null;
  if (
    !Number.isInteger(target.pos) ||
    target.pos < 0 ||
    target.pos >= doc.content.size
  )
    return null;
  const $pos = doc.resolve(target.pos),
    node = $pos.nodeAfter;
  if (
    !node ||
    node.type.name !== ("nodeType" in target ? target.nodeType : target.type) ||
    !isCoreBlock(node.type.name)
  )
    return null;
  if (
    $pos.depth < 1 ||
    $pos.node(1).type.name !== "container" ||
    $pos.index(0) !== 1 ||
    doc.childCount !== 2 ||
    doc.firstChild?.type.name !== "globalContent"
  )
    return null;
  for (let depth = 2; depth <= $pos.depth; depth++)
    if (
      !$pos.node(depth).isBlock ||
      $pos.node(depth).isTextblock ||
      $pos.node(depth).isAtom
    )
      return null;
  return { node, parent: $pos.parent, index: $pos.index(), $pos };
}
export function selectedCoreBlock(editor: Editor): LegacyBlockTarget | null {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    isCoreBlock(selection.node.type.name)
  ) {
    const target = {
      pos: selection.from,
      type: selection.node.type.name,
      revision: getEditorSessionRevision(editor),
    };
    return resolveBlock(editor, target) ? target : null;
  }
  if (
    !(selection instanceof TextSelection) ||
    selection.$from.parent !== selection.$to.parent
  )
    return null;
  for (let d = selection.$from.depth; d > 0; d--) {
    const type = selection.$from.node(d).type.name;
    if (isCoreBlock(type) && selection.$from.node(d).isTextblock) {
      const target: LegacyBlockTarget = {
        pos: selection.$from.before(d),
        type,
        revision: getEditorSessionRevision(editor),
      };
      return resolveBlock(editor, target) ? target : null;
    }
  }
  return null;
}
export function dispatchBlockTransaction(
  editor: Editor,
  tr: Transaction,
  focus = true,
) {
  const contract = createDocumentContract(editor.options.extensions);
  if (!validateDocument(tr.doc.toJSON(), contract).ok) return false;
  const revision = getEditorSessionRevision(editor);
  editor.view.dispatch(closeEditorHistory(tr));
  // Public appendTransaction plugins may add trailing nodes after an accepted edit.
  if (tr.docChanged && getEditorSessionRevision(editor) === revision)
    return false;
  // Seal this structural action from both preceding edits and subsequent typing.
  editor.view.dispatch(
    closeEditorHistory(editor.state.tr).setMeta("addToHistory", false),
  );
  if (focus) editor.view.focus();
  if (focus && typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.view.focus();
    });
  return true;
}
export function insertCoreBlock(
  editor: Editor,
  kind: CoreBlockKind,
  variant?: { headingLevel: number },
  providedTarget?: BlockTarget | null,
): boolean {
  const target = providedTarget ?? selectedCoreBlock(editor);
  if (!target) return false;
  const resolved = resolveBlock(editor, target);
  if (!resolved) return false;
  const { schema } = editor.state;
  if (kind === "heading" && ![1, 2, 3].includes(variant?.headingLevel ?? 0))
    return false;
  const node =
    kind === "section"
      ? schema.nodes.section.createChecked(
          null,
          Fragment.from(schema.nodes.paragraph.createChecked()),
        )
      : schema.nodes[kind].createChecked(
          kind === "heading" ? { level: variant?.headingLevel } : null,
        );
  if (
    !resolved.parent.canReplace(
      resolved.index + 1,
      resolved.index + 1,
      Fragment.from(node),
    )
  )
    return false;
  const pos = target.pos + resolved.node.nodeSize,
    tr = editor.state.tr.insert(pos, node);
  tr.setSelection(
    TextSelection.create(tr.doc, pos + (kind === "section" ? 2 : 1)),
  ).setStoredMarks(null);
  return dispatchBlockTransaction(editor, tr);
}
export function canRunBlockAction(
  editor: Editor,
  target: Target,
  action: BlockAction,
): boolean {
  const r = resolveBlock(editor, target);
  if (!r) return false;
  if (action === "moveUp")
    return (
      r.index > 0 &&
      r.parent.canReplace(
        r.index - 1,
        r.index + 1,
        Fragment.fromArray([r.node, r.parent.child(r.index - 1)]),
      )
    );
  if (action === "moveDown")
    return (
      r.index + 1 < r.parent.childCount &&
      r.parent.canReplace(
        r.index,
        r.index + 2,
        Fragment.fromArray([r.parent.child(r.index + 1), r.node]),
      )
    );
  if (action === "duplicate")
    return r.parent.canReplace(r.index + 1, r.index + 1, Fragment.from(r.node));
  // Deletion may fill a required parent with an empty paragraph. Validate the
  // resulting document instead of rejecting that valid ProseMirror normalization.
  const tr = editor.state.tr.delete(target.pos, target.pos + r.node.nodeSize);
  return validateDocument(
    tr.doc.toJSON(),
    createDocumentContract(editor.options.extensions),
  ).ok;
}
export function runBlockAction(
  editor: Editor,
  target: Target,
  action: BlockAction,
): boolean {
  if (!canRunBlockAction(editor, target, action)) return false;
  const r = resolveBlock(editor, target);
  if (!r) return false;
  const tr = editor.state.tr,
    { pos } = target,
    end = pos + r.node.nodeSize;
  let nextPos = pos;
  if (action === "moveUp") {
    const previous = r.parent.child(r.index - 1);
    nextPos = pos - previous.nodeSize;
    tr.replaceWith(nextPos, end, Fragment.fromArray([r.node, previous]));
  } else if (action === "moveDown") {
    const next = r.parent.child(r.index + 1);
    nextPos = pos + next.nodeSize;
    tr.replaceWith(
      pos,
      end + next.nodeSize,
      Fragment.fromArray([next, r.node]),
    );
  } else if (action === "duplicate") {
    nextPos = end;
    tr.insert(end, r.node);
  } else {
    tr.delete(pos, end);
    tr.setSelection(
      Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size - 1))),
    );
  }
  if (action !== "delete") {
    const selected = editor.state.selection;
    if (
      action !== "duplicate" &&
      selected instanceof TextSelection &&
      selected.from > pos &&
      selected.to < end
    )
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          nextPos + selected.anchor - pos,
          nextPos + selected.head - pos,
        ),
      );
    else tr.setSelection(NodeSelection.create(tr.doc, nextPos));
  }
  return dispatchBlockTransaction(editor, tr);
}
/** Text conversion eligibility follows the registered schema, not a formatting whitelist. */
export function canConvertCoreText(editor: Editor): boolean {
  const target = resolveBlockTarget(editor);
  return !!target && canConvertTextTarget(editor, target);
}
export function canConvertTextTarget(
  editor: Editor,
  target: BlockTarget,
): boolean {
  if (!["paragraph", "heading"].includes(target.nodeType)) return false;
  return !!resolveBlock(editor, target);
}
export function convertCoreText(
  editor: Editor,
  headingLevel?: number,
): boolean {
  if (
    !canConvertCoreText(editor) ||
    (headingLevel !== undefined && ![1, 2, 3].includes(headingLevel))
  )
    return false;
  const target = selectedCoreBlock(editor);
  if (!target) return false;
  const node = editor.state.doc.nodeAt(target.pos);
  if (!node) return false;
  const type = editor.schema.nodes[headingLevel ? "heading" : "paragraph"];
  if (
    node.type === type &&
    (!headingLevel || node.attrs.level === headingLevel)
  )
    return false;
  const tr = editor.state.tr.setNodeMarkup(
    target.pos,
    type,
    headingLevel ? { ...node.attrs, level: headingLevel } : { ...node.attrs },
  );
  return dispatchBlockTransaction(editor, tr);
}

/** Attribute edits use the same fresh-target and export preflight boundary as actions. */
export function updateBlockAttributes(
  editor: Editor,
  target: BlockTarget,
  patch: Record<string, unknown>,
): boolean {
  const r = resolveBlock(editor, target);
  if (!r) return false;
  const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, {
    ...r.node.attrs,
    ...patch,
  });
  if (editor.state.selection instanceof NodeSelection)
    tr.setSelection(NodeSelection.create(tr.doc, target.pos));
  return dispatchBlockTransaction(editor, tr, false);
}
