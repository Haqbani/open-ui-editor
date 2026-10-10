import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { useRef, useState } from "react";
import { resolveBlockTarget } from "../blocks/commands";
import { type BlockDefinition, getBlockDefinitions } from "../blocks/registry";
import {
  beginToolbarDrag,
  endToolbarDrag,
  TOOLBAR_DRAG_MIME,
} from "../blocks/toolbar-drop";
import { closeEditorHistory } from "../history/history-boundary";
import { startImageUploads } from "../services/image-upload";
import { Icon } from "./icons";

const groups = {
  Text: [
    "Text",
    "Title",
    "Subtitle",
    "Heading",
    "Bullet list",
    "Numbered list",
  ],
  Image: ["Image", "YouTube", "X (Twitter)", "Chart"],
  Components: [
    "Button",
    "Divider",
    "Section",
    "2 columns",
    "3 columns",
    "4 columns",
    "Table",
    "Social Links",
    "Unsubscribe Footer",
    "HTML",
    "Code",
  ],
  Variables: [],
};
function insert(editor: Editor, definition: BlockDefinition) {
  editor.view.dispatch(closeEditorHistory(editor.state.tr));
  const { menuLabel: label } = definition;
  if (["Text", "Title", "Subtitle", "Heading"].includes(label))
    editor
      .chain()
      .focus()
      .insertContentAt(editor.state.selection.head, {
        type: definition.nodeType,
        ...(label !== "Text"
          ? {
              attrs: {
                level: ["Title", "Subtitle", "Heading"].indexOf(label) + 1,
              },
            }
          : {}),
      })
      .run();
  else if (label === "Bullet list")
    editor.chain().focus().toggleBulletList().run();
  else if (label === "Numbered list")
    editor.chain().focus().toggleOrderedList().run();
  else if (label === "Code") editor.chain().focus().toggleCodeBlock().run();
  else if (label === "Button") editor.chain().focus().setButton().run();
  else if (label === "Divider")
    editor.chain().focus().setHorizontalRule().run();
  else if (label === "Section") editor.chain().focus().insertSection().run();
  else if (definition.createDragContent) {
    const content = definition.createDragContent(editor);
    if (content) editor.chain().focus().insertContent(content).run();
  } else definition.execute(editor, resolveBlockTarget(editor));
  editor.view.dom.dispatchEvent(new CustomEvent("palette-command"));
}
export function InsertionPalette({ editor }: { editor: Editor | null }) {
  const [active, setActive] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLUListElement>(null),
    dragged = useRef(false);
  const definitions = getBlockDefinitions();
  return (
    <EditorFocusScope>
      <div data-testid="insertion-palette" className="palette-anchor">
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: The native chooser input is hidden, so it cannot receive page focus. */}
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-hidden="true"
          onChange={(event) => {
            if (event.target.files?.length && editor && !editor.isDestroyed)
              startImageUploads(
                Array.from(event.target.files),
                editor,
                editor.state.selection.from,
              );
            event.target.value = "";
          }}
        />
        <NavigationMenu.Root
          orientation="vertical"
          delay={100}
          closeDelay={200}
          value={active}
          onValueChange={setActive}
          data-testid="tool-palette"
        >
          <NavigationMenu.List ref={anchor} className="palette-frame">
            {(Object.keys(groups) as (keyof typeof groups)[]).map((name) => (
              <NavigationMenu.Item key={name} value={name}>
                <NavigationMenu.Trigger
                  render={
                    <button
                      type="button"
                      aria-label={name}
                      aria-haspopup="menu"
                      className="icon-button"
                      onClick={(event) => event.preventDefault()}
                    >
                      <Icon name={name} size={16} />
                    </button>
                  }
                />
                <NavigationMenu.Content>
                  <div className="insertion-items" role="menu">
                    {name === "Variables" ? (
                      <p className="palette-empty">No variables available</p>
                    ) : (
                      groups[name].map((label) => {
                        const definition = definitions.find(
                          (item) => item.menuLabel === label,
                        );
                        return (
                          <button
                            type="button"
                            role="menuitem"
                            key={label}
                            className="control-option"
                            disabled={!definition || !editor}
                            draggable={!!definition?.dragId && !!editor}
                            onDragStart={(event) => {
                              if (
                                !editor ||
                                !definition?.dragId ||
                                !beginToolbarDrag(editor, definition.dragId)
                              ) {
                                event.preventDefault();
                                return;
                              }
                              dragged.current = true;
                              event.dataTransfer.setData(
                                TOOLBAR_DRAG_MIME,
                                JSON.stringify({
                                  commandId: definition.dragId,
                                }),
                              );
                              event.dataTransfer.setData("text/plain", label);
                              event.dataTransfer.effectAllowed = "copy";
                              const preview = document.createElement("div");
                              preview.style.cssText =
                                "position:fixed;top:-1000px;left:-1000px;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:#1c1c1e;border:1px solid rgba(255,255,255,.1);color:#fff;font:13px system-ui;white-space:nowrap";
                              const svg = event.currentTarget
                                .querySelector("svg")
                                ?.cloneNode(true) as SVGElement | undefined;
                              if (svg) {
                                svg.style.cssText =
                                  "width:16px;height:16px;color:#9b9b9b;flex-shrink:0";
                                preview.append(svg);
                              }
                              preview.append(document.createTextNode(label));
                              document.body.append(preview);
                              event.dataTransfer.setDragImage(preview, 0, 0);
                              requestAnimationFrame(() => preview.remove());
                            }}
                            onDragEnd={() => {
                              if (editor) endToolbarDrag(editor);
                              setTimeout(() => {
                                dragged.current = false;
                              }, 0);
                            }}
                            onClick={() => {
                              if (dragged.current || !definition || !editor)
                                return;
                              if (label === "Image") {
                                imageInput.current?.click();
                                setActive(null);
                              } else insert(editor, definition);
                            }}
                          >
                            <Icon name={label} size={16} />
                            <span>{label}</span>
                            {definition?.dragId && (
                              <span className="palette-grip" aria-hidden="true">
                                <svg
                                  aria-hidden="true"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M9 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4m6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4m-6-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4m6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4M9 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4m6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner
              anchor={anchor}
              side="right"
              align="start"
              sideOffset={6}
              className="palette-positioner"
            >
              <EditorFocusScope>
                <NavigationMenu.Popup className="insertion-menu">
                  <NavigationMenu.Viewport />
                </NavigationMenu.Popup>
              </EditorFocusScope>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      </div>
    </EditorFocusScope>
  );
}
