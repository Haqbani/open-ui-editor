"use client";
import { EditorContext } from "@tiptap/react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { EmailDocumentEditor } from "./EmailDocumentEditor";
import { CodePane } from "./export/CodePane";
import { PreviewPane } from "./export/PreviewPane";
import { acceptPreview, type PreviewState } from "./export/preview-state";
import { serializeEmail } from "./export/serialize-email";
import { InspectorRouter } from "./inspector/InspectorRouter";
import { OverlayPanelsProvider } from "./panels/OverlayPanels";
import { createReferenceDocument } from "./reference-document";
import { EditorShell } from "./shell/EditorShell";
import { createMemoryStorage } from "./storage/editor-storage";
import type { DraftStorage, TemplateDraft } from "./types";
import { useEditorController } from "./use-editor-controller";

function ReadyWorkspace({
  initial,
  storage,
}: {
  initial: TemplateDraft;
  storage?: DraftStorage;
}) {
  const controller = useEditorController(initial, storage);
  const [preview, setPreview] = useState<PreviewState>({
    requestedRevision: controller.draft.revision,
    result: null,
  });
  const { editor, mode, draft } = controller;
  useLayoutEffect(() => {
    let active = true;
    setPreview({ requestedRevision: draft.revision, result: null });
    if (editor && mode === "code") {
      void serializeEmail(
        editor,
        draft.metadata.previewText,
        draft.revision,
      ).then((result) => {
        if (active) setPreview((current) => acceptPreview(current, result));
      });
    }
    return () => {
      active = false;
    };
  }, [editor, mode, draft.revision, draft.metadata.previewText]);
  const result =
    preview.requestedRevision === draft.revision ? preview.result : null;
  const context = useMemo(
    () => ({ editor: controller.editor }),
    [controller.editor],
  );
  return (
    <EditorContext.Provider value={context}>
      <OverlayPanelsProvider>
        <EditorShell
          controller={controller}
          canvas={
            <EmailDocumentEditor
              editor={controller.editor}
              focusMode={controller.focusMode}
            />
          }
          code={
            result?.ok ? (
              <CodePane html={result.html} />
            ) : (
              <div
                className="export-message"
                role={result ? "alert" : undefined}
              >
                {result && !result.ok
                  ? result.issues.map((issue) => (
                      <p key={`${issue.path}:${issue.code}`}>
                        {issue.path}: {issue.message}
                      </p>
                    ))
                  : "Generating HTML…"}
              </div>
            )
          }
          preview={
            result?.ok ? <PreviewPane html={result.unformattedHtml} /> : null
          }
          inspector={<InspectorRouter editor={controller.editor} />}
        />
      </OverlayPanelsProvider>
    </EditorContext.Provider>
  );
}

export function EditorWorkspace({
  initialDraft,
  memoryOnly = false,
  appearance,
}: {
  initialDraft?: TemplateDraft;
  memoryOnly?: boolean;
  appearance?: "dark" | "light";
} = {}) {
  const [storage] = useState(() =>
    memoryOnly ? createMemoryStorage() : undefined,
  );
  const [ready, setReady] = useState(false);
  const [initial] = useState<TemplateDraft>(
    () =>
      initialDraft ?? {
        id: "foundation",
        title: "Neutral template",
        metadata: { from: "", replyTo: "", subject: "", previewText: "" },
        document: createReferenceDocument(),
        revision: 0,
      },
  );
  useEffect(() => {
    setReady(true);
    document.documentElement.dataset.appearance =
      appearance ??
      (new URLSearchParams(window.location.search).get("devAppearance") ===
      "dark"
        ? "dark"
        : "light");
  }, [appearance]);
  // Matching initial server/client output; read Storage and create Tiptap only after hydration.
  return ready ? (
    <ReadyWorkspace initial={initial} storage={storage} />
  ) : (
    <main className="workspace-loading">Loading editor…</main>
  );
}
