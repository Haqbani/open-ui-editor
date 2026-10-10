import type { Editor } from "@tiptap/core";
import {
  type BlockTarget,
  resolveBlock,
  updateBlockAttributes,
} from "../blocks/commands";
import { AlignmentField } from "../controls/AlignmentField";
import { TypographyControls } from "../controls/TypographyControls";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { SizeControls } from "./SizeControls";
import { ThemeOptions } from "./ThemeOptions";
export function ButtonInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const block = resolveBlock(editor, target);
  if (!block) return null;
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="button">Button</InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={target.pos} />
      </InspectorHeading>
      <AlignmentField
        value={block.node.attrs.alignment ?? "left"}
        onChange={(alignment) =>
          updateBlockAttributes(editor, target, { alignment })
        }
      />
      <h3>Link</h3>
      <input
        className="field-surface"
        aria-label="Button link"
        placeholder="https://example.com"
        value={block.node.attrs.href ?? ""}
        onChange={(event) =>
          updateBlockAttributes(editor, target, { href: event.target.value })
        }
      />
      <h3>Typography</h3>
      <TypographyControls editor={editor} pos={target.pos} section />
      <SizeControls editor={editor} pos={target.pos} />
      <LayoutControls groups={{}} editor={editor} pos={target.pos} />
    </div>
  );
}
