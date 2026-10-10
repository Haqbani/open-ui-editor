import type { Editor } from "@tiptap/core";
import type { BlockTarget } from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
export function DividerInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="horizontalRule">Divider</InspectorNodeTitle>
      </InspectorHeading>
      <LayoutControls
        groups={{}}
        editor={editor}
        pos={target.pos}
        background={false}
        border={false}
      />
    </div>
  );
}
