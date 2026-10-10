import type { Editor } from "@tiptap/core";
import { useState } from "react";
import {
  type BlockTarget,
  resolveBlock,
  updateBlockAttributes,
} from "../blocks/commands";
import { AlignmentField } from "../controls/AlignmentField";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { ThemeOptions } from "./ThemeOptions";
import { TypographyGroup } from "./TypographyGroup";

function AttributeField({
  name,
  value,
  commit,
}: {
  name: string;
  value: string;
  commit: (value: string) => void;
}) {
  const [edit, setEdit] = useState({ source: value, draft: value });
  const draft = edit.source === value ? edit.draft : value;
  return (
    <label className="control-row">
      <span>{name}</span>
      <input
        aria-label={name}
        className="field-surface"
        value={draft}
        onChange={(e) => setEdit({ source: value, draft: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            setEdit({ source: value, draft: value });
          }
        }}
      />
    </label>
  );
}
export function ListInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const block = resolveBlock(editor, target);
  if (!block) return null;
  const ordered = target.nodeType === "orderedList";
  const item = target.nodeType === "listItem";
  const styles = String(block.node.attrs.style ?? "");
  // Production generic Start/Type edits are styles, not changes to marker attrs.
  const genericStyle = (key: string, value: string) => {
    const retained = styles
      .split(";")
      .filter((part) => part.trim() && part.split(":")[0].trim() !== key);
    if (value.trim()) retained.push(`${key}:${value.trim()}`);
    updateBlockAttributes(editor, target, { style: retained.join(";") });
  };
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type={target.nodeType}>
          {item ? "List Item" : ordered ? "Ordered List" : "Bullet List"}
        </InspectorNodeTitle>
        <ThemeOptions editor={editor} pos={target.pos} />
      </InspectorHeading>
      <AlignmentField
        value={block.node.attrs.alignment ?? "left"}
        onChange={(alignment) =>
          updateBlockAttributes(editor, target, { alignment })
        }
      />
      {!item && (
        <>
          <h3>Attributes</h3>
          <AttributeField
            name="Tight"
            value={String(block.node.attrs.tight)}
            commit={(value) => genericStyle("tight", value)}
          />
        </>
      )}
      {ordered && (
        <>
          <AttributeField
            name="Start"
            value={String(block.node.attrs.start)}
            commit={(value) => genericStyle("start", value)}
          />
          <AttributeField
            name="Type"
            value={block.node.attrs.type ?? ""}
            commit={(value) => genericStyle("type", value)}
          />
        </>
      )}
      <TypographyGroup editor={editor} pos={target.pos} />
      <LayoutControls
        groups={{ border: false }}
        editor={editor}
        pos={target.pos}
        background={false}
      />
      {styles
        .split(";")
        .some((part) => /^(start|type|tight):/.test(part.trim())) && (
        <>
          <h3>Styles</h3>
          {styles
            .split(";")
            .filter((part) => /^(start|type|tight):/.test(part.trim()))
            .map((part) => {
              const [key, value] = part.trim().split(":");
              return (
                <AttributeField
                  key={key}
                  name={key[0].toUpperCase() + key.slice(1)}
                  value={value}
                  commit={(next) => genericStyle(key, next)}
                />
              );
            })}
        </>
      )}
    </div>
  );
}
