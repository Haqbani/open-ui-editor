"use client";

import { useEditorImage } from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import type { SelectionBookmark } from "@tiptap/pm/state";
import { useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDocumentContract } from "./document-contract";
import { createEditorExtensions } from "./extensions";
import { startImageUploads } from "./services/image-upload";
import { localMediaServices } from "./services/media";
import { readDraft, writeDraft } from "./storage/draft-store";
import { setEditorStorage } from "./storage/editor-storage";
import { applySaveResult } from "./storage/save-state";
import type {
  DraftStorage,
  SaveResult,
  SaveState,
  TemplateDraft,
  TemplateMetadata,
} from "./types";

export type EditorMode = "editor" | "code";
export type ActivePanel =
  | "inspector"
  | "theme"
  | "css"
  | "variables"
  | "history"
  | null;
export type EditorController = {
  editor: Editor | null;
  draft: TemplateDraft;
  saveState: SaveState;
  loadFailure: { message: string; raw: string | null } | null;
  mode: EditorMode;
  focusMode: boolean;
  setMode: (mode: EditorMode) => void;
  panel: ActivePanel;
  setPanel: (panel: ActivePanel) => void;
  setMetadata: (patch: Partial<TemplateMetadata>) => void;
  setTitle: (title: string) => void;
};

/** Mount only after the workspace client boundary is ready. This loads before editor creation. */
export function useEditorController(
  initial: TemplateDraft,
  storage?: DraftStorage,
): EditorController {
  const image = useEditorImage({
    uploadImage: async (file) => {
      const result = await localMediaServices.upload(
        file,
        { draftId: initial.id, revision: 0, requestId: crypto.randomUUID() },
        new AbortController().signal,
      );
      if (!result.ok) throw Error(result.message);
      return result.value;
    },
  });
  const schemaExtensions = useMemo(
    () => createEditorExtensions(image),
    [image],
  );
  const contract = useMemo(
    () => createDocumentContract(schemaExtensions),
    [schemaExtensions],
  );
  const [loaded] = useState(() => {
    try {
      if (typeof window === "undefined")
        return { draft: initial, failure: null };
      const result = readDraft(
        storage ?? window.localStorage,
        initial.id,
        contract,
      );
      return {
        draft: result.kind === "loaded" ? result.draft : initial,
        failure:
          result.kind === "invalid" || result.kind === "unavailable"
            ? {
                message: result.message,
                raw: result.kind === "invalid" ? result.raw : null,
              }
            : null,
      };
    } catch {
      return {
        draft: initial,
        failure: { message: "Local storage could not be read.", raw: null },
      };
    }
  });
  const [draft, setDraft] = useState(loaded.draft);
  const extensions = useMemo(
    () =>
      createEditorExtensions(image, {
        document: loaded.draft.document,
        contract,
      }),
    [image, loaded, contract],
  );
  const [saveState, setSaveState] = useState<SaveState>({
    revision: loaded.draft.revision,
    savedRevision: loaded.failure ? -1 : loaded.draft.revision,
    status: loaded.failure ? "failed" : "saved",
  });
  const [focusMode, setFocusMode] = useState(false);
  const [mode, setMode] = useState<EditorMode>("editor");
  const [panel, setPanel] = useState<ActivePanel>("inspector");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode === "code") return;
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setFocusMode((current) => !current);
      } else if (event.key === "Escape") setFocusMode(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode]);
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor(
    {
      immediatelyRender: false,
      onBeforeCreate: ({ editor }) => {
        if (storage) setEditorStorage(editor, storage);
      },
      extensions,

      editorProps: {
        handlePaste(view, event) {
          const files = Array.from(event.clipboardData?.files ?? []).filter(
            (file) => file.type.includes("image/"),
          );
          if (!files.length) return false;
          event.preventDefault();
          const instance = editorRef.current;
          if (!instance) return false;
          startImageUploads(files, instance, view.state.selection.from);
          return true;
        },
        handleDrop(view, event, _slice, moved) {
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (moved || !files.length) return false;
          event.preventDefault();
          const instance = editorRef.current;
          if (!instance) return false;
          const hit = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          startImageUploads(
            files,
            instance,
            Math.max(0, hit ? hit.pos - 1 : view.state.selection.from),
          );
          return true;
        },
        attributes: { "aria-label": "Email body", spellcheck: "false" },
      },
      onUpdate: ({ editor: updated }) => {
        // The seeded Y fragment is installed while the view initializes. It
        // is loaded JSON, not a user edit or a new persisted revision.
        if (!updated.isInitialized) return;
        setDraft((current) => ({
          ...current,
          document: updated.getJSON(),
          revision: current.revision + 1,
        }));
      },
    },
    [],
  );

  editorRef.current = editor;
  useEffect(() => {
    if (!editor) return;
    const history = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        mode === "code" ||
        editor.view.dom.contains(event.target as Node)
      )
        return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement) &&
        !target.closest("[data-editor-history-scope]")
      )
        return;
      const key = event.key.toLowerCase();
      const action =
        key === "z"
          ? event.shiftKey
            ? "redo"
            : "undo"
          : key === "y" && !event.shiftKey
            ? "redo"
            : null;
      if (action && editor.isEditable && editor.commands[action]())
        event.preventDefault();
    };
    document.addEventListener("keydown", history);
    return () => document.removeEventListener("keydown", history);
  }, [editor, mode]);

  useEffect(() => {
    if (draft === loaded.draft) return;
    // A failed load quarantines this key for the entire session, even after
    // fallback revisions catch up or Storage becomes available later.
    if (loaded.failure) {
      setSaveState((current) => ({
        ...current,
        revision: draft.revision,
        status: "failed",
      }));
      return;
    }
    setSaveState((current) => ({
      ...current,
      revision: draft.revision,
      status: "saving",
    }));
    // Acquiring Storage may itself throw (privacy/security settings).
    let result: SaveResult;
    try {
      result = writeDraft(storage ?? window.localStorage, draft, contract);
    } catch {
      result = {
        ok: false as const,
        revision: draft.revision,
        reason: "unavailable" as const,
      };
    }
    setSaveState((current) => applySaveResult(current, result));
  }, [draft, loaded, contract, storage]);

  const modeSelection = useRef<SelectionBookmark | null>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    const returning = previousMode.current === "code" && mode === "editor";
    previousMode.current = mode;
    if (!returning || !editor) return;
    // Restore the caret without changing the captured mode-button focus.
    const frame = requestAnimationFrame(() => {
      const selection = modeSelection.current?.resolve(editor.state.doc);
      if (selection)
        editor.view.dispatch(editor.state.tr.setSelection(selection));
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, mode]);

  return {
    editor,
    draft,
    saveState,
    loadFailure: loaded.failure,
    mode,
    focusMode,
    setMode: (nextMode) => {
      if (nextMode === "code" && editor)
        modeSelection.current = editor.state.selection.getBookmark();
      setMode(nextMode);
    },
    panel,
    setPanel,
    setMetadata: (patch) =>
      setDraft((current) => ({
        ...current,
        metadata: { ...current.metadata, ...patch },
        revision: current.revision + 1,
      })),
    setTitle: (title) =>
      setDraft((current) => ({
        ...current,
        title,
        revision: current.revision + 1,
      })),
  };
}
