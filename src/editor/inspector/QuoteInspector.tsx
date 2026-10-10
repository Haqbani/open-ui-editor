import type { Editor } from "@tiptap/core";
import type { BlockTarget } from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { ThemeOptions } from "./ThemeOptions";
import { TypographyGroup } from "./TypographyGroup";
export function QuoteInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="blockquote">Blockquote</InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={target.pos} />
      </InspectorHeading>
      <TypographyGroup editor={editor} pos={target.pos} />
      <LayoutControls
        groups={{ background: false }}
        editor={editor}
        pos={target.pos}
      />
    </div>
  );
}
