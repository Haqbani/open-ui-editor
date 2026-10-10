import { Menu } from "@base-ui/react/menu";
import { EDITOR_THEMES, getPanelTitle } from "@react-email/editor/plugins";
import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { useRef } from "react";
import { getEditorSessionRevision } from "../blocks/commands";
import { useOverlayPanels } from "../panels/OverlayPanels";
import { Icon } from "../shell/icons";
import { FloatingInspectorLayer } from "./InspectorFrame";
import { documentPanels } from "./style-adapter";
import {
  applyNodeThemeOperation,
  currentTheme,
  nodeThemeChanges,
  themeComponent,
} from "./theme-operations";

export function ThemeOptions({ editor, pos }: { editor: Editor; pos: number }) {
  const overlay = useOverlayPanels();
  const captured = useRef<{ pos: number; revision: number } | null>(null);
  if (!themeComponent(editor, pos)) return null;
  const changes = nodeThemeChanges(editor, pos);
  const component = themeComponent(editor, pos);
  const canPromote = [
    ...EDITOR_THEMES[currentTheme(editor)],
    ...documentPanels(editor),
  ].some(
    (panel) =>
      panel.classReference === component ||
      panel.inputs.some((input) => input.classReference === component),
  );
  const perform = (promote: boolean) => {
    const target = captured.current;
    if (target)
      applyNodeThemeOperation(editor, target.pos, promote, target.revision);
    document
      .querySelector<HTMLElement>("[data-testid=editor-inspector]")
      ?.focus({ preventScroll: true });
  };
  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (!open)
          document
            .querySelector<HTMLElement>("[data-testid=editor-inspector]")
            ?.focus({ preventScroll: true });
        if (open)
          captured.current = {
            pos,
            revision: getEditorSessionRevision(editor),
          };
      }}
    >
      <Menu.Trigger aria-label="Theme options" className="theme-options">
        <Icon name="Theme options" />
        {!!changes.changes.length && <span className="theme-dirty" />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="control-positioner">
          <EditorFocusScope>
            <Menu.Popup className="control-popup" finalFocus={false}>
              <FloatingInspectorLayer>
                <div className="control-menu-label">Theme options</div>
                <Menu.Item
                  className="control-option"
                  disabled={!canPromote || !changes.promotable.length}
                  onClick={() => perform(true)}
                >
                  <Icon name="Paint" /> Set as default
                </Menu.Item>
                <Menu.Item
                  className="control-option"
                  onClick={() => {
                    const target = captured.current;
                    if (
                      !target ||
                      target.revision !== getEditorSessionRevision(editor)
                    )
                      return;
                    const panel = documentPanels(editor).find(
                      (p) =>
                        p.classReference === themeComponent(editor, target.pos),
                    );
                    overlay?.open(
                      "theme",
                      panel
                        ? getPanelTitle(
                            panel as Parameters<typeof getPanelTitle>[0],
                          )
                        : undefined,
                    );
                  }}
                >
                  <Icon name="Theme options" /> Edit theme
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item
                  className="control-option"
                  disabled={!changes.changes.length}
                  onClick={() => perform(false)}
                >
                  <Icon name="Reset" /> Discard
                </Menu.Item>
              </FloatingInspectorLayer>
            </Menu.Popup>
          </EditorFocusScope>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
