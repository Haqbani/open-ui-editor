import type { InspectorNodeContext } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { ThemeOptions } from "./ThemeOptions";
import { TypographyGroup } from "./TypographyGroup";
export function SectionInspector({
  editor,
  context,
}: {
  editor: Editor;
  context: InspectorNodeContext;
}) {
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="section">Section</InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={context.nodePos.pos} />
      </InspectorHeading>
      <TypographyGroup editor={editor} pos={context.nodePos.pos} />
      <LayoutControls editor={editor} pos={context.nodePos.pos} />
    </div>
  );
}
