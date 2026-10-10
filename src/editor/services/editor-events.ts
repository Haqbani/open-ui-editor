import { isDocumentVisuallyEmpty } from "@react-email/editor/core";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
export type AiPromptContext = {
  selection?: {
    text: string;
    blockIndex: number;
    totalBlocks: number;
    nodeType: string;
  };
  selectionRange?: { from: number; to: number };
};
/** Task6 owns the service subscriber; this event always carries live editor context. */
export function getAiPromptContext(
  editor: Editor,
  source: "slash" | "bubble",
): AiPromptContext {
  const { from, to, $from } = editor.state.selection;
  let detail: AiPromptContext = {};
  if (source === "bubble") {
    const types = new Set<string>();
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isBlock && !["doc", "container"].includes(node.type.name))
        types.add(node.type.name);
    });
    detail = {
      selection: {
        text: editor.state.doc.textBetween(from, to, " "),
        blockIndex: $from.index(0),
        totalBlocks: types.size,
        nodeType:
          editor.state.selection instanceof NodeSelection
            ? editor.state.selection.node.type.name
            : $from.parent.type.name,
      },
    };
  } else if (!isDocumentVisuallyEmpty(editor.state.doc)) {
    detail = {
      selection: {
        text: $from.parent.textContent,
        blockIndex: 0,
        totalBlocks: 1,
        nodeType: $from.parent.type.name,
      },
      selectionRange: {
        from: $from.before($from.depth),
        to: $from.after($from.depth),
      },
    };
  }
  return detail;
}
export function openAiPrompt(editor: Editor, source: "slash" | "bubble") {
  const from = editor.state.selection.from;
  const detail = getAiPromptContext(editor, source);
  editor.view.dom.dispatchEvent(
    new CustomEvent<AiPromptContext>("ai-prompt:open", {
      detail,
      bubbles: true,
    }),
  );
  if (source === "bubble") editor.commands.setTextSelection(from);
}
