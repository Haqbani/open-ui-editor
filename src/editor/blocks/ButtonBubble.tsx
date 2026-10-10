import {
  BubbleMenu,
  bubbleMenuTriggers,
  LinkIcon,
  useBubbleMenuContext,
} from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { useState } from "react";
import {
  captureLinkSession,
  LinkPopover,
  type LinkSession,
} from "../shell/LinkPopover";

const key = new PluginKey("buttonBubbleMenu");
export function ButtonBubble({ editor }: { editor: Editor }) {
  const [session, setSession] = useState<LinkSession | null>(null);
  return (
    <BubbleMenu.Root
      pluginKey={key}
      trigger={bubbleMenuTriggers.node("button")}
      placement="bottom"
      offset={8}
      onHide={() => setSession(null)}
      className="button-bubble"
    >
      <ButtonLink editor={editor} session={session} setSession={setSession} />
    </BubbleMenu.Root>
  );
}
function ButtonLink({
  editor,
  session,
  setSession,
}: {
  editor: Editor;
  session: LinkSession | null;
  setSession: (session: LinkSession | null) => void;
}) {
  const { setIsEditing } = useBubbleMenuContext();
  return (
    <div className="application-link-selector">
      <div
        className="button-link-toolbar"
        style={{ visibility: session ? "hidden" : undefined }}
      >
        <button
          type="button"
          aria-label="Edit link"
          className="button-link-trigger"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSession(captureLinkSession(editor, "button"));
            setIsEditing(true);
          }}
        >
          <LinkIcon size={16} />
        </button>
      </div>
      {session && (
        <LinkPopover
          editor={editor}
          session={session}
          onClose={() => {
            setSession(null);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
}
