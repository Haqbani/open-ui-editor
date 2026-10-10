import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { useLayoutEffect, useRef } from "react";
import { type BlockTarget, getEditorSessionRevision } from "../blocks/commands";
/** Draft ownership is independent of component identity: pickers remain mounted. */
export function useFamilyTarget(
  editor: Editor,
  target: BlockTarget,
  reconcile: (node: Node | null, replaced: boolean) => void,
) {
  const binding = useRef({
    pos: target.pos,
    type: target.nodeType,
    revision: target.revision,
    node: editor.state.doc.nodeAt(target.pos),
  });
  const get = () => {
    const b = binding.current,
      n = editor.state.doc.nodeAt(b.pos);
    return b.pos === target.pos &&
      b.type === target.nodeType &&
      b.revision === getEditorSessionRevision(editor) &&
      n === b.node &&
      n?.type.name === b.type
      ? n
      : null;
  };
  const accept = () => {
    binding.current = {
      pos: target.pos,
      type: target.nodeType,
      revision: getEditorSessionRevision(editor),
      node: editor.state.doc.nodeAt(target.pos),
    };
  };
  useLayoutEffect(() => {
    const node = editor.state.doc.nodeAt(target.pos),
      old = binding.current;
    const changed =
      old.pos !== target.pos ||
      old.type !== target.nodeType ||
      old.node !== node;
    const revisionChanged = old.revision !== getEditorSessionRevision(editor);
    accept();
    if (changed || revisionChanged)
      reconcile(node?.type.name === target.nodeType ? node : null, changed);
  });
  return { get, accept };
}
