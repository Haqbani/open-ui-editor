import { BubbleMenu, bubbleMenuTriggers } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { useState } from "react";
import { chooseImage } from "../services/image-upload";
import {
  applyLinkSession,
  captureLinkSession,
  LinkPopover,
  type LinkSession,
} from "../shell/LinkPopover";

const key = new PluginKey("imageBubbleMenu");
export function ImageBubble({ editor }: { editor: Editor }) {
  const [session, setSession] = useState<LinkSession | null>(null);
  return (
    <BubbleMenu.Root
      pluginKey={key}
      trigger={bubbleMenuTriggers.node("image")}
      className="image-bubble control-popup"
      data-re-bubble-menu=""
      onHide={() => setSession(null)}
    >
      <div className="application-link-selector">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            chooseImage(editor, undefined, editor.state.selection.from)
          }
        >
          Replace Image
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setSession(captureLinkSession(editor, "image"))}
        >
          Edit Link
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            applyLinkSession(editor, captureLinkSession(editor, "image"), "")
          }
        >
          Remove Link
        </button>
        {session && (
          <LinkPopover
            editor={editor}
            session={session}
            onClose={() => setSession(null)}
          />
        )}
      </div>
    </BubbleMenu.Root>
  );
}
