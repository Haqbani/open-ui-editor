import type { ReactNode } from "react";
import { InspectorFrame } from "../inspector/InspectorFrame";
import { OverlayPanels } from "../panels/OverlayPanels";
import type { EditorController } from "../use-editor-controller";
import { InsertionPalette } from "./InsertionPalette";
import { MetadataFields } from "./MetadataFields";
import { ModeRail } from "./ModeRail";
import { TopBar } from "./TopBar";

export function EditorShell({
  controller,
  canvas,
  inspector,
  code,
  preview,
}: {
  controller: EditorController;
  canvas: ReactNode;
  inspector: ReactNode;
  code: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="editor-workspace" data-focus-mode={controller.focusMode}>
      <div className="editor-surface">
        <TopBar controller={controller} />
        <main
          className={`workspace-shell ${controller.mode === "code" ? "code-mode" : ""}`}
        >
          <ModeRail controller={controller} />
          <div data-testid="editor-canvas" className="editor-canvas">
            <MetadataFields controller={controller} />
            <div hidden={controller.mode !== "editor"}>{canvas}</div>
            {controller.mode === "code" && preview}
          </div>
          {controller.mode === "code" && code}
          {controller.mode === "editor" && !controller.focusMode && (
            <InsertionPalette editor={controller.editor} />
          )}
          <InspectorFrame
            editor={controller.editor}
            visible={
              controller.panel !== null &&
              controller.mode === "editor" &&
              !controller.focusMode
            }
          >
            {inspector}
          </InspectorFrame>
        </main>
        <OverlayPanels editor={controller.editor} />
      </div>
      <footer className="agent-footer">
        <button type="button" disabled>
          ＋ &nbsp;Ask about this template
        </button>
      </footer>
    </div>
  );
}
