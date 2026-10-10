import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useState } from "react";
import { Icon } from "../shell/icons";
import {
  captureLinkSession,
  LinkPopover,
  type LinkSession,
} from "../shell/LinkPopover";
export function TextLinkControls({ editor }: { editor: Editor }) {
  const href = useEditorState({
    editor,
    selector: ({ editor }) => String(editor.getAttributes("link").href ?? ""),
  });
  const [session, setSession] = useState<LinkSession | null>(null);
  return (
    <div className="inspector-section inspector-link-controls">
      <h3 className="link-heading">
        Link
        {!href && (
          <button
            type="button"
            aria-label="Add link"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().setLink({ href: "#" }).run()}
          >
            <Icon name="Add Link" />
          </button>
        )}
      </h3>
      {href && (
        <div className="link-actions">
          <button
            type="button"
            aria-label="Edit link"
            onClick={() => setSession(captureLinkSession(editor))}
          >
            <Icon name="Header Link" />
            Edit link
          </button>
          <button
            type="button"
            aria-label="Remove link"
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          >
            Remove link
          </button>
          <a href={href} target="_blank" rel="noreferrer">
            Open link
          </a>
        </div>
      )}
      {session && (
        <LinkPopover
          editor={editor}
          session={session}
          onClose={() => setSession(null)}
        />
      )}
    </div>
  );
}
