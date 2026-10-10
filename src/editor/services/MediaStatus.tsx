import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
export function MediaStatus({ editor }: { editor: Editor }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const update = (event: Event) =>
      setMessage(String((event as CustomEvent).detail));
    editor.view.dom.addEventListener("media-error", update);
    return () => editor.view.dom.removeEventListener("media-error", update);
  }, [editor]);
  return message ? (
    <div className="export-message" role="alert">
      {message}
      <button
        type="button"
        aria-label="Dismiss upload error"
        onClick={() => setMessage("")}
      >
        ×
      </button>
    </div>
  ) : null;
}
