import type { Editor } from "@tiptap/core";
import type { BlockTarget } from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { SizeControls } from "./SizeControls";
export function HtmlInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="htmlContent">HTML</InspectorNodeTitle>
      </InspectorHeading>
      <SizeControls editor={editor} pos={target.pos} />
      <LayoutControls
        editor={editor}
        pos={target.pos}
        background={false}
        groups={{}}
      />
    </div>
  );
}
