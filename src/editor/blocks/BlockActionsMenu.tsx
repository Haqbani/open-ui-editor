import { Menu } from "@base-ui/react/menu";
import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  type BlockAction,
  canRunBlockAction,
  type LegacyBlockTarget,
  resolveBlock,
  resolveBlockTarget,
  runBlockAction,
} from "./commands";
import { handleColors } from "./handle-colors";
import { HandleIcon } from "./handle-icons";
import { turnIntoTextFamily } from "./text-family";

const actions = [
  ["moveUp", "Move up"],
  ["moveDown", "Move down"],
  ["duplicate", "Duplicate"],
  ["delete", "Delete"],
] as const;
const conversions = [
  ["Text", "paragraph"],
  ["Title", "heading", 1],
  ["Subtitle", "heading", 2],
  ["Heading", "heading", 3],
  ["Bullet list", "bulletList"],
  ["Numbered list", "orderedList"],
  ["Quote", "blockquote"],
] as const;
const convertible = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
]);

export function BlockActionsMenu({
  editor,
  getTarget,
  description,
  onEditWithAi,
}: {
  description: string;
  onEditWithAi?: (
    editor: Editor,
    target: import("./commands").BlockTarget,
  ) => void;
  editor: Editor;
  getTarget: () => LegacyBlockTarget | null;
}) {
  const colors = useEditorState({
    editor,
    selector: ({ editor }) => handleColors(editor),
  });
  const returnSelection = useRef<LegacyBlockTarget | null>(null);
  const acted = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{
    target: LegacyBlockTarget;
    anchor: DOMRect;
  } | null>(null);
  const target = menu?.target ?? getTarget();
  const close = () => {
    if (menu && !acted.current) returnSelection.current = menu.target;
    setMenu(null);
    if (!editor.isDestroyed) editor.commands.setMeta("lockDragHandle", false);
  };
  useEffect(() => {
    const changed = () => {
      // Never apply a portaled action to the next occupant of a deleted position.
      setMenu(null);
      editor.commands.setMeta("lockDragHandle", false);
    };
    editor.on("update", changed);
    return () => {
      editor.off("update", changed);
    };
  }, [editor]);
  const freshTarget = () => {
    const current = menu?.target ?? getTarget();
    return current && resolveBlock(editor, current) ? current : null;
  };
  const act = (action: BlockAction) => {
    const current = freshTarget();
    if (current) acted.current = runBlockAction(editor, current, action);
    close();
  };
  const ai = () => {
    const current = freshTarget(),
      fresh = current && resolveBlockTarget(editor, current.pos);
    if (fresh && onEditWithAi) {
      acted.current = true;
      onEditWithAi(editor, fresh);
      close();
    }
  };
  return (
    <Menu.Root
      open={!!menu}
      onOpenChange={(open) => {
        if (!open) {
          close();
          return;
        }
        const current = getTarget();
        if (!current || !resolveBlock(editor, current) || !trigger.current)
          return;
        const anchor = trigger.current.getBoundingClientRect();
        acted.current = false;
        editor.commands.setNodeSelection(current.pos);
        editor.commands.setMeta("lockDragHandle", true);
        const selected = getTarget();
        if (selected && resolveBlock(editor, selected))
          setMenu({ target: { ...selected }, anchor });
      }}
    >
      <EditorFocusScope>
        <Menu.Trigger
          ref={trigger}
          onPointerDown={(event) => event.preventBaseUIHandler()}
          onMouseDown={(event) => event.preventBaseUIHandler()}
          aria-label="Block actions"
          className="block-action-handle"
          data-dark-body={colors.isDark}
          style={
            {
              "--drag-handle-bg": colors.foreground,
              "--drag-handle-bg-hover": colors.foregroundHover,
            } as CSSProperties
          }
          aria-description={description}
          onFocus={() => {
            const current = returnSelection.current;
            returnSelection.current = null;
            if (current && resolveBlock(editor, current))
              editor.commands.setNodeSelection(current.pos);
          }}
          onKeyDown={(event) => {
            if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault();
              act("delete");
            }
          }}
        >
          <HandleIcon name="Grip" />
        </Menu.Trigger>
      </EditorFocusScope>
      <Menu.Portal>
        <Menu.Positioner
          side="left"
          align="start"
          sideOffset={8}
          anchor={
            menu ? { getBoundingClientRect: () => menu.anchor } : undefined
          }
          className="block-menu-positioner"
        >
          <EditorFocusScope>
            <Menu.Popup
              className="block-actions-popup"
              aria-label="Block actions"
              finalFocus={() => {
                // Base UI restores focus after the popup unmount. The public focus
                // scope clears selection during that blur; restore only this fresh
                // captured node when focus actually returns to the handle.
                if (acted.current) returnSelection.current = null;
                return acted.current ? editor.view.dom : trigger.current;
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace") {
                  event.preventDefault();
                  act("delete");
                } else if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key.toLowerCase() === "d"
                ) {
                  event.preventDefault();
                  act("duplicate");
                } else if (event.key === "/" && onEditWithAi) {
                  event.preventDefault();
                  ai();
                }
              }}
            >
              <Menu.Item
                className="block-menu-item"
                disabled={!onEditWithAi || !target}
                onClick={ai}
              >
                <HandleIcon name="Edit with AI" />
                Edit with AI<kbd>/</kbd>
              </Menu.Item>
              {target && convertible.has(target.type) && (
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className="block-menu-item">
                    <HandleIcon name="Turn into" />
                    Turn into
                    <HandleIcon
                      name="Chevron"
                      size={14}
                      className="block-menu-end"
                    />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="block-menu-positioner"
                    >
                      <EditorFocusScope>
                        <Menu.Popup className="block-actions-popup block-turn-into-popup">
                          {conversions.map(([label, type, level]) => (
                            <Menu.Item
                              key={label}
                              className="block-menu-item"
                              onClick={() => {
                                const current = freshTarget(),
                                  fresh =
                                    current &&
                                    resolveBlockTarget(editor, current.pos);
                                if (fresh)
                                  acted.current = turnIntoTextFamily(
                                    editor,
                                    fresh,
                                    type,
                                    level,
                                  );
                                close();
                              }}
                            >
                              <HandleIcon name={label} />
                              {label}
                              {target.type === type &&
                                (type !== "heading" ||
                                  editor.state.doc.nodeAt(target.pos)?.attrs
                                    .level === level) && (
                                  <HandleIcon
                                    name="Check"
                                    size={14}
                                    className="block-menu-end"
                                  />
                                )}
                            </Menu.Item>
                          ))}
                        </Menu.Popup>
                      </EditorFocusScope>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              )}
              <Menu.Separator className="block-menu-separator" />
              {actions.map(([action, label]) => (
                <span key={action} className="block-menu-action-group">
                  {action === "delete" && (
                    <Menu.Separator className="block-menu-separator" />
                  )}
                  <Menu.Item
                    className={`block-menu-item${action === "delete" ? " block-menu-delete" : ""}`}
                    disabled={
                      !target || !canRunBlockAction(editor, target, action)
                    }
                    onClick={() => act(action)}
                  >
                    <HandleIcon name={label} />
                    {label}
                    {action === "duplicate" && (
                      <span className="block-menu-shortcuts">
                        <kbd>⌘</kbd>
                        <kbd>D</kbd>
                      </span>
                    )}
                    {action === "delete" && <kbd>⌫</kbd>}
                  </Menu.Item>
                </span>
              ))}
            </Menu.Popup>
          </EditorFocusScope>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
