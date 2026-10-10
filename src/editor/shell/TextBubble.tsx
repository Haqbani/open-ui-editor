import { editorEventBus } from "@react-email/editor/core";
import {
  BubbleMenu,
  bubbleMenuTriggers,
  type TriggerFn,
} from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { openAiPrompt } from "../services/editor-events";
import { Icon } from "./icons";
import { ApplicationCheck, ApplicationLinkSelector } from "./LinkPopover";
import { ToolbarTooltip } from "./ToolbarTooltip";

const textKey = new PluginKey("textBubbleMenu");
const selected = bubbleMenuTriggers.textSelection([
  "image",
  "button",
  "htmlContent",
  "socialLinks",
  "youtube",
  "twitter",
  "variable",
  "plot",
  "ogLinkPreview",
]);
// Tiptap's public BubbleMenu supplies element at runtime; the wrapper's
// TriggerParams declaration currently omits that optional field.
const trigger: TriggerFn = (
  params: Parameters<TriggerFn>[0] & { element?: HTMLElement },
) =>
  !!(
    params.view.hasFocus() || params.element?.contains(document.activeElement)
  ) && selected(params);
export function TextBubble({
  editor,
  focusMode,
  withAi = false,
}: {
  editor: Editor;
  focusMode: boolean;
  withAi?: boolean;
}) {
  const [selector, setSelector] = useState(false),
    [link, setLink] = useState(false);
  useEffect(() => {
    const subscription = editorEventBus.on("bubble-menu:add-link", () => {
      if (!editor.isDestroyed && editor.view.hasFocus()) {
        setSelector(false);
        setLink(true);
      }
    });
    const dispose = () => subscription.unsubscribe();
    editor.on("destroy", dispose);
    return () => {
      dispose();
      editor.off("destroy", dispose);
    };
  }, [editor]);

  return (
    <BubbleMenu.Root
      pluginKey={textKey}
      trigger={trigger}
      placement="bottom"
      offset={8}
      onHide={() => {
        setSelector(false);
        setLink(false);
      }}
      data-testid="text-bubble"
      className={`text-bubble${focusMode ? " focus-hidden" : ""}`}
    >
      <BubbleMenu.NodeSelector.Root
        className="text-node-selector"
        open={selector}
        onOpenChange={(open) => {
          setSelector(open);
          if (open) setLink(false);
        }}
      >
        <BubbleMenu.NodeSelector.Trigger className="text-node-trigger" />
        <BubbleMenu.NodeSelector.Content className="text-node-list">
          {(items, close) =>
            items.map((item) => (
              <button
                type="button"
                key={item.name}
                onClick={() => {
                  item.command();
                  close();
                  requestAnimationFrame(() => {
                    if (!editor.isDestroyed) editor.view.focus();
                  });
                }}
              >
                <div className="text-node-label">
                  <div className="text-node-icon">
                    <Icon
                      name={
                        item.name === "Bullet List"
                          ? "Bullet list"
                          : item.name === "Numbered List"
                            ? "Numbered list"
                            : item.name
                      }
                      size={20}
                    />
                  </div>
                  <span>{item.name}</span>
                </div>
                {item.isActive && <ApplicationCheck size={12} />}
              </button>
            ))
          }
        </BubbleMenu.NodeSelector.Content>
      </BubbleMenu.NodeSelector.Root>
      <ApplicationLinkSelector
        editor={editor}
        open={link}
        setOpen={(open) => {
          setLink(open);
          if (open) setSelector(false);
        }}
      />
      <BubbleMenu.ItemGroup className="text-formatting">
        <ToolbarTooltip of="bold">
          <BubbleMenu.Bold>
            <Icon name="Bold" />
          </BubbleMenu.Bold>
        </ToolbarTooltip>
        <ToolbarTooltip of="italic">
          <BubbleMenu.Italic>
            <Icon name="Italic" />
          </BubbleMenu.Italic>
        </ToolbarTooltip>
        <ToolbarTooltip of="underline">
          <BubbleMenu.Underline>
            <Icon name="Underline" />
          </BubbleMenu.Underline>
        </ToolbarTooltip>
        <ToolbarTooltip of="strike">
          <BubbleMenu.Strike>
            <Icon name="Strikethrough" />
          </BubbleMenu.Strike>
        </ToolbarTooltip>
        <ToolbarTooltip of="code">
          <BubbleMenu.Code>
            <Icon name="HTML" />
          </BubbleMenu.Code>
        </ToolbarTooltip>
      </BubbleMenu.ItemGroup>
      {withAi && (
        <ToolbarTooltip of="ai">
          <button
            type="button"
            aria-label="Edit with AI"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openAiPrompt(editor, "bubble")}
          >
            <Icon name="AI" />
            Edit
          </button>
        </ToolbarTooltip>
      )}
    </BubbleMenu.Root>
  );
}
