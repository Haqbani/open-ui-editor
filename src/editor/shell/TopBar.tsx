"use client";
import { Menu } from "@base-ui/react/menu";
import { useEffect, useRef, useState } from "react";
import type { EditorController } from "../use-editor-controller";
import { Icon } from "./icons";

export function TopBar({ controller }: { controller: EditorController }) {
  const titleInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(controller.draft.title);
  useEffect(() => {
    if (editing) {
      titleInput.current?.focus();
      titleInput.current?.select();
    }
  }, [editing]);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const raw = controller.loadFailure?.raw;
  useEffect(() => {
    if (raw === undefined || raw === null) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/octet-stream" }),
    );
    setRecoveryUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [raw]);
  return (
    <header data-testid="editor-topbar" className="topbar">
      <button
        className="icon-button home-button"
        type="button"
        aria-label="Back to Templates"
        disabled
      >
        <Icon name="Home" size={18} />
      </button>
      <div className="template-heading">
        <span className="templates-label">
          <Icon name="Templates" size={18} />
          Templates
        </span>
        <span>/</span>
        {editing ? (
          <input
            aria-label="Template title"
            ref={titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                controller.setTitle(title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="title-button"
              onClick={() => {
                setTitle(controller.draft.title);
                setEditing(true);
              }}
            >
              {controller.draft.title}
            </button>
            <span className="draft-badge">Draft</span>
          </>
        )}
      </div>
      <div className="topbar-actions">
        <span role="status" className="save-status">
          {controller.loadFailure
            ? "Local draft could not be loaded"
            : controller.saveState.status === "failed"
              ? "Could not save locally"
              : controller.saveState.status === "saved"
                ? "Saved locally"
                : "Saving locally…"}
        </span>
        {controller.loadFailure && (
          <details className="draft-recovery">
            <summary>Draft recovery</summary>
            <div role="alert" className="draft-recovery-message">
              <p>{controller.loadFailure.message}</p>
              <p>
                Changes in this session are not saved. The saved record has not
                been replaced.
              </p>
              {recoveryUrl && (
                <a
                  href={recoveryUrl}
                  download={`${controller.draft.id}-saved-raw.json`}
                >
                  Download saved raw draft
                </a>
              )}
            </div>
          </details>
        )}
        <Menu.Root>
          <Menu.Trigger className="more-button" aria-label="More actions">
            <Icon name="More actions" size={12} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={8}>
              <Menu.Popup className="shell-menu">
                {[
                  "Test email",
                  "Variables",
                  "Version history",
                  "View details",
                  "Duplicate",
                  "Delete",
                ].map((label) => (
                  <Menu.Item key={label} disabled>
                    {label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <button type="button" className="publish-button" disabled>
          Publish
        </button>
      </div>
    </header>
  );
}
