import type { Editor, EditorEvents } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Transaction } from "@tiptap/pm/state";
import { yUndoPluginKey } from "@tiptap/y-tiptap";

const boundary = "localHistoryBoundary";
export const historyGesture = "localHistoryGesture";
type Gesture = { identity: symbol; end: () => void };
const gestures = new WeakMap<Editor, Gesture>();

/** Pure metadata: constructing a chain or can() must not change history. */
export function closeEditorHistory(tr: Transaction) {
  // Retain PM metadata for explicit headless PM fixtures only. Runtime has one
  // Collaboration owner, which consumes our marker before the view syncs.
  return closeHistory(tr).setMeta(boundary, true);
}

export function getHistoryManager(editor: Editor) {
  return yUndoPluginKey.getState(editor.state)?.undoManager;
}

export function setHistoryGesture(editor: Editor, gesture: Gesture) {
  gestures.get(editor)?.end();
  gestures.set(editor, gesture);
}

export function clearHistoryGesture(editor: Editor, identity: symbol) {
  if (gestures.get(editor)?.identity === identity) gestures.delete(editor);
}

export function installHistoryBoundaries(editor: Editor) {
  const beforeTransaction = ({
    transaction,
    nextState,
  }: EditorEvents["beforeTransaction"]) => {
    // A filtered root transaction returns the current state unchanged.
    if (nextState === editor.state) return;
    const gesture = gestures.get(editor);
    const closes = transaction.getMeta(boundary);
    const changes = !nextState.doc.eq(editor.state.doc);
    if (
      gesture &&
      (closes ||
        (changes && transaction.getMeta(historyGesture) !== gesture.identity))
    ) {
      gesture.end();
    }
    if (closes) getHistoryManager(editor)?.stopCapturing();
  };
  editor.on("beforeTransaction", beforeTransaction);
  return () => {
    gestures.get(editor)?.end();
    gestures.delete(editor);
    editor.off("beforeTransaction", beforeTransaction);
  };
}
