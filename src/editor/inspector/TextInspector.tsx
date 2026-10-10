import { Menu } from "@base-ui/react/menu";
import {
  EditorFocusScope,
  type InspectorNodeContext,
  type InspectorTextContext,
} from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useRef } from "react";
import { canConvertCoreText, convertCoreText } from "../blocks/commands";
import { convertTextFamily } from "../blocks/text-family";
import { AlignmentField } from "../controls/AlignmentField";
import { TypographyControls } from "../controls/TypographyControls";
import { Icon } from "../shell/icons";
import { InspectorHeading } from "./InspectorChrome";
import { FloatingInspectorLayer } from "./InspectorFrame";
import { LayoutControls } from "./LayoutControls";
import { selectedBlock } from "./style-adapter";
import { TextLinkControls } from "./TextLinkControls";
import { ThemeOptions } from "./ThemeOptions";
export function TextInspector({
  editor,
  context,
}: {
  editor: Editor;
  context: InspectorTextContext | InspectorNodeContext;
}) {
  const typeTrigger = useRef<HTMLButtonElement>(null);
  const block = selectedBlock(editor);
  if (!block) return null;
  const title =
    block.node.type.name === "heading"
      ? ["", "Title", "Subtitle", "Heading"][Number(block.node.attrs.level)]
      : "Body";
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <h2>
          {title === "Title" ? (
            <Icon name="Header H1" />
          ) : title === "Subtitle" ? (
            <Icon name="Header H2" />
          ) : title === "Heading" ? (
            <Icon name="Header H3" />
          ) : (
            <Icon name="Header Text" />
          )}
          {title}
        </h2>
        <div className="inspector-actions">
          <ThemeOptions editor={editor} pos={block.pos} />
          <Menu.Root
            onOpenChange={(open, details) => {
              if (!open && details.reason === "escape-key")
                typeTrigger.current?.focus({ preventScroll: true });
            }}
          >
            <Menu.Trigger ref={typeTrigger} aria-label="Change text type">
              <Icon name="Change text type" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className="control-positioner">
                <EditorFocusScope>
                  <Menu.Popup finalFocus={false} className="control-popup">
                    <FloatingInspectorLayer>
                      {["Title", "Subtitle", "Heading", "Body"].map((item) => (
                        <Menu.Item
                          className="control-option"
                          key={item}
                          aria-current={item === title ? "true" : undefined}
                          disabled={!canConvertCoreText(editor)}
                          onClick={() =>
                            convertCoreText(
                              editor,
                              item === "Body"
                                ? undefined
                                : ["Title", "Subtitle", "Heading"].indexOf(
                                    item,
                                  ) + 1,
                            )
                          }
                        >
                          <span className="flex w-full items-center gap-2">
                            <span aria-hidden="true">
                              {item === "Title" ? (
                                <Icon name="Header H1" />
                              ) : item === "Subtitle" ? (
                                <Icon name="Header H2" />
                              ) : item === "Heading" ? (
                                <Icon name="Header H3" />
                              ) : (
                                <Icon name="Header Text" />
                              )}
                            </span>
                            {item}
                            {item === title && (
                              <span aria-hidden="true" className="ml-auto">
                                <Icon name="Check" size={14} />
                              </span>
                            )}
                          </span>
                        </Menu.Item>
                      ))}
                    </FloatingInspectorLayer>
                  </Menu.Popup>
                </EditorFocusScope>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </InspectorHeading>
      <div className="inspector-section text-format-section">
        <div className="inspector-section-content">
          <TypographyControls editor={editor} pos={block.pos} />
          <div className="segmented mark-controls">
            {[
              ["bold", "Bold", "B"],
              ["italic", "Italic", "I"],
              ["underline", "Underline", "U"],
              ["strike", "Strikethrough", "S"],
              ["code", "Code", "‹/›"],
              ["uppercase", "Uppercase", "AB"],
            ].map(([mark, label, icon]) => (
              <button
                type="button"
                key={mark}
                aria-label={label}
                aria-pressed={editor.isActive(mark)}
                disabled={!editor.schema.marks[mark]}
                onClick={() => {
                  const selection = editor.state.selection;
                  if (
                    (selection.empty || selection instanceof NodeSelection) &&
                    block.node.content.size
                  ) {
                    const chain = editor
                      .chain()
                      .setTextSelection({
                        from: block.pos + 1,
                        to: block.pos + 1 + block.node.content.size,
                      })
                      .toggleMark(mark);
                    if (selection instanceof NodeSelection)
                      chain.setNodeSelection(block.pos);
                    else chain.setTextSelection(selection.from);
                    chain.run();
                  } else editor.chain().toggleMark(mark).run();
                }}
              >
                {
                  {
                    B: <Icon name="Bold" />,
                    I: <Icon name="Italic" />,
                    U: <Icon name="Underline" />,
                    S: <Icon name="Strikethrough" />,
                    "‹/›": <Icon name="Inline code" />,
                    AB: <Icon name="Uppercase" />,
                  }[icon]
                }
              </button>
            ))}
          </div>
          <AlignmentField
            value={
              "alignment" in context
                ? context.alignment || "left"
                : String(context.getAttr("alignment") ?? "left")
            }
            onChange={(value) => {
              if ("setAlignment" in context) context.setAlignment(value);
              else context.setAttr("alignment", value);
            }}
          />
          <div className="later-formatting">
            {[["Blockquote"], ["Bullet list", "Ordered list"]].map(
              (labels, index) => (
                <div
                  className={`segmented ${index === 0 ? "quote-formatting" : "list-formatting"}`}
                  key={labels[0]}
                >
                  {labels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      disabled={!canConvertCoreText(editor)}
                      aria-label={label}
                      aria-pressed={editor.isActive(
                        label === "Blockquote"
                          ? "blockquote"
                          : label === "Bullet list"
                            ? "bulletList"
                            : "orderedList",
                      )}
                      onClick={() =>
                        convertTextFamily(
                          editor,
                          label === "Blockquote"
                            ? "blockquote"
                            : label === "Bullet list"
                              ? "bulletList"
                              : "orderedList",
                        )
                      }
                    >
                      {label === "Blockquote" ? (
                        <Icon name="Blockquote" />
                      ) : label === "Bullet list" ? (
                        <Icon name="Bullet list" />
                      ) : (
                        <Icon name="Ordered list" />
                      )}
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
      <TextLinkControls editor={editor} />
      <LayoutControls editor={editor} pos={block.pos} />
    </div>
  );
}
