import type { Editor } from "@tiptap/core";
import type { DraftStorage } from "../types";

// An editor-scoped override also isolates preference actions reached through
// node views, inspectors, and insertion commands. Never replace global Storage.
const overrides = new WeakMap<Editor, DraftStorage>();
export function setEditorStorage(editor: Editor, storage: DraftStorage) {
  overrides.set(editor, storage);
}
export function getEditorStorage(editor?: Editor): DraftStorage {
  return (editor && overrides.get(editor)) || window.localStorage;
}
export function createMemoryStorage(): DraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
