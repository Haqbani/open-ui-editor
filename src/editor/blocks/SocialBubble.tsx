import { editorEventBus } from "@react-email/editor/core";
import type { Editor } from "@tiptap/core";
import { NodeSelection, PluginKey } from "@tiptap/pm/state";
import { BubbleMenu } from "@tiptap/react/menus";
import { HandleIcon } from "./handle-icons";

const key = new PluginKey("socialLinksBubbleMenu");
/** Public Social bubble owns named inspector recovery independently of caret clicks. */
export function SocialBubble({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={key}
      className="social-bubble"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ state }) =>
        state.selection instanceof NodeSelection &&
        state.selection.node.type.name === "socialLinks"
      }
    >
      <div className="social-bubble-toolbar">
        <button
          type="button"
          aria-label="Edit social links"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const selection = editor.state.selection;
            if (
              selection instanceof NodeSelection &&
              selection.node.type.name === "socialLinks"
            )
              editorEventBus.dispatch("node-clicked", {
                nodeType: selection.node.type.name,
                nodeAttrs: selection.node.attrs,
                nodePos: { pos: selection.from, inside: selection.from },
              });
          }}
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="16"
            viewBox="0 0 24 24"
            width="16"
          >
            <path
              stroke="currentColor"
              strokeWidth="2"
              d="m5.843 13.572 9.547-9.548a.5.5 0 0 1 .707 0l3.882 3.882a.5.5 0 0 1 0 .707l-9.547 9.548a.5.5 0 0 1-.33.145l-4.067.184a.5.5 0 0 1-.522-.522l.184-4.066a.5.5 0 0 1 .087-.26z"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Delete social links"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.commands.deleteSelection()}
        >
          <HandleIcon name="Delete" />
        </button>
      </div>
    </BubbleMenu>
  );
}
