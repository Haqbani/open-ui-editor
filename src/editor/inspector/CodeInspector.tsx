import { Select } from "@base-ui/react/select";
import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import {
  type BlockTarget,
  resolveBlock,
  updateBlockAttributes,
} from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { FloatingInspectorLayer } from "./InspectorFrame";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { ThemeOptions } from "./ThemeOptions";

const languages = [
  ["css", "CSS"],
  ["go", "Go"],
  ["html", "HTML"],
  ["javascript", "JavaScript"],
  ["jsx", "JSX"],
  ["json", "JSON"],
  ["markdown", "Markdown"],
  ["php", "PHP"],
  ["plaintext", "Plain text"],
  ["python", "Python"],
  ["ruby", "Ruby"],
  ["shell", "Shell"],
  ["sql", "SQL"],
  ["svg", "svg"],
  ["typescript", "TypeScript"],
];
const themes = [
  ["default", "Default"],
  ["atomDark", "Atom Dark"],
  ["oneLight", "Atom Light"],
  ["dracula", "Dracula"],
  ["nord", "Nord"],
  ["duotoneDark", "Duotone Dark"],
  ["duotoneForest", "Duotone Forest"],
  ["duotoneLight", "Duotone Light"],
  ["duotoneSea", "Duotone Sea"],
  ["duotoneSpace", "Duotone Space"],
  ["vesper", "Vesper"],
  ["vs", "VSCode Light"],
  ["vscDarkPlus", "VSCode Dark"],
];
export function CodeInspector({
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
        <InspectorNodeTitle type="codeBlock">Code Block</InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={target.pos} />
      </InspectorHeading>
      <h3>Attributes</h3>
      {(
        [
          ["language", "Language", languages],
          ["theme", "Theme", themes],
        ] as const
      ).map(([attribute, label, options]) => (
        <div key={attribute} className="control-row">
          <span>{label}</span>
          <Select.Root
            value={String(block.node.attrs[attribute])}
            onValueChange={(value) => {
              if (value)
                updateBlockAttributes(editor, target, { [attribute]: value });
            }}
          >
            <Select.Trigger
              className="field-surface"
              aria-label={`Code ${attribute}`}
            >
              <Select.Value>
                {(value) =>
                  options.find(([id]) => id === value)?.[1] ?? String(value)
                }
              </Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="control-positioner">
                <EditorFocusScope>
                  <Select.Popup className="control-popup">
                    <FloatingInspectorLayer>
                      {options.map(([id, label]) => (
                        <Select.Item
                          key={id}
                          value={id}
                          className="control-option"
                        >
                          <Select.ItemText>{label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </FloatingInspectorLayer>
                  </Select.Popup>
                </EditorFocusScope>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ))}
      <LayoutControls
        groups={{}}
        editor={editor}
        pos={target.pos}
        background={false}
      />
    </div>
  );
}
