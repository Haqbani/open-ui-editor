import type { Editor } from "@tiptap/core";
import { BlockActionsMenu } from "./BlockActionsMenu";
import type { LegacyBlockTarget } from "./commands";

/** One combined menu/drag handle, rendered inside the official DragHandle surface. */
export function BlockChrome({
  editor,
  getTarget,
  description,
  onEditWithAi,
}: {
  editor: Editor;
  getTarget: () => LegacyBlockTarget | null;
  description: string;
  onEditWithAi?: (
    editor: Editor,
    target: import("./commands").BlockTarget,
  ) => void;
}) {
  return (
    <BlockActionsMenu
      editor={editor}
      onEditWithAi={onEditWithAi}
      getTarget={getTarget}
      description={description}
    />
  );
}
