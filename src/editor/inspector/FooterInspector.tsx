import type { Editor } from "@tiptap/core";
import type { BlockTarget } from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { ThemeOptions } from "./ThemeOptions";
import { TypographyGroup } from "./TypographyGroup";
export function FooterInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="footer">Footer</InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={target.pos} />
      </InspectorHeading>
      <TypographyGroup editor={editor} pos={target.pos} />
      <LayoutControls editor={editor} pos={target.pos} groups={{}} />
    </div>
  );
}
