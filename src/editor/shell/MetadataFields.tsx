"use client";
import { useState } from "react";
import type { EditorController } from "../use-editor-controller";

export function MetadataFields({
  controller,
}: {
  controller: EditorController;
}) {
  const metadata = controller.draft.metadata;
  const [reply, setReply] = useState(Boolean(metadata.replyTo));
  const [preview, setPreview] = useState(Boolean(metadata.previewText));
  return (
    <div className="metadata-fields">
      <div className="metadata-row">
        <label htmlFor="email-from">From</label>
        <input
          id="email-from"
          placeholder="Acme <acme@example.com>"
          value={metadata.from}
          onChange={(e) => controller.setMetadata({ from: e.target.value })}
        />
        {!reply && (
          <button type="button" onClick={() => setReply(true)}>
            Reply-To
          </button>
        )}
      </div>
      {reply && (
        <div className="metadata-row">
          <label htmlFor="email-reply">Reply-To</label>
          <input
            id="email-reply"
            value={metadata.replyTo}
            onChange={(e) =>
              controller.setMetadata({ replyTo: e.target.value })
            }
          />
        </div>
      )}
      {preview && (
        <div className="metadata-row">
          <label htmlFor="email-preview">Preview</label>
          <input
            id="email-preview"
            value={metadata.previewText}
            onChange={(e) =>
              controller.setMetadata({ previewText: e.target.value })
            }
          />
        </div>
      )}
      <div className="metadata-row">
        <input
          aria-label="Subject"
          placeholder="Subject"
          value={metadata.subject}
          onChange={(e) => controller.setMetadata({ subject: e.target.value })}
        />
        {!preview && (
          <button type="button" onClick={() => setPreview(true)}>
            Preview text
          </button>
        )}
      </div>
    </div>
  );
}
