import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import {
  clearHistoryGesture,
  closeEditorHistory,
  getHistoryManager,
  historyGesture,
  setHistoryGesture,
} from "../history/history-boundary";

// Only synchronous writes made by a picker callback receive this identity.
const colorWrites = new WeakMap<Editor, symbol>();

export function prepareStyleTransaction(editor: Editor, tr: Transaction) {
  const identity = colorWrites.get(editor);
  return identity
    ? tr.setMeta(historyGesture, identity)
    : closeEditorHistory(tr);
}

export function finishStyleTransaction(editor: Editor) {
  if (!colorWrites.has(editor) && !editor.isDestroyed)
    editor.view.dispatch(closeEditorHistory(editor.state.tr));
}

export function beginColorGesture(editor: Editor) {
  const identity = Symbol("color-gesture");
  const manager = getHistoryManager(editor);
  let ended = editor.isDestroyed;
  let restoreInterval: (() => void) | undefined;
  const end = () => {
    if (ended) return;
    ended = true;
    restoreInterval?.();
    clearHistoryGesture(editor, identity);
    if (colorWrites.get(editor) === identity) colorWrites.delete(editor);
    editor.off("destroy", end);
    manager?.stopCapturing();
  };
  if (!ended) {
    setHistoryGesture(editor, { identity, end });
    manager?.stopCapturing();
    editor.on("destroy", end);
  }
  return {
    apply(change: () => void) {
      if (editor.isDestroyed) return;
      if (ended) {
        change();
        return;
      }
      // Public Yjs interval override is synchronous only, never left enlarged
      // while the pointer is idle. Each later sample can join across a pause.
      const ownsOverride = !restoreInterval;
      const previousWrite = colorWrites.get(editor);
      if (manager && ownsOverride) {
        const previous = manager.captureTimeout;
        manager.captureTimeout = Number.POSITIVE_INFINITY;
        restoreInterval = () => {
          manager.captureTimeout = previous;
          restoreInterval = undefined;
        };
      }
      const restore = restoreInterval;
      colorWrites.set(editor, identity);
      try {
        change();
      } catch (error) {
        end();
        throw error;
      } finally {
        // Ending/superseding during change already restored the interval. Do
        // not revive that scope or clobber a newer gesture's override/token.
        if (ownsOverride && restoreInterval === restore) restoreInterval?.();
        if (colorWrites.get(editor) === identity) {
          if (previousWrite === identity && !ended)
            colorWrites.set(editor, identity);
          else colorWrites.delete(editor);
        }
      }
    },
    end,
  };
}
