import type { Editor } from "@tiptap/core";
import { useState } from "react";
import {
  type BlockTarget,
  resolveBlock,
  updateBlockAttributes,
} from "../blocks/commands";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { SizeControls } from "./SizeControls";
import { TypographyGroup } from "./TypographyGroup";

// A revision invalidates pending text without unmounting sibling controls or
// interrupting their active color gesture.
function useTargetDraft(target: BlockTarget) {
  const owner = `${target.nodeType}:${target.pos}:${target.revision}`;
  const [pending, setPending] = useState<{
    owner: string;
    value: string;
  } | null>(null);
  return [
    pending?.owner === owner ? pending.value : null,
    (value: string | null) =>
      setPending(value === null ? null : { owner, value }),
  ] as const;
}

export function ColumnsInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const block = resolveBlock(editor, target);
  const [draft, setDraft] = useTargetDraft(target);
  if (!block) return null;
  const child = target.nodeType === "columnsColumn";
  const styles = String(block.node.attrs.style ?? "");
  const value =
    styles
      .match(/(?:^|;)\s*cellspacing\s*:\s*([^;]*)/)?.[1]
      ?.replace(/px$/, "") ?? "";
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type={target.nodeType}>
          {child ? "Column" : `${block.node.childCount} Columns`}
        </InspectorNodeTitle>
      </InspectorHeading>
      {!child && (
        <label className="control-row">
          <span>Cellspacing</span>
          <input
            className="field-surface"
            aria-label="Cellspacing"
            value={draft ?? value}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const next = (draft ?? value).trim();
                const retained = styles
                  .split(";")
                  .filter(
                    (s) => s.trim() && s.split(":")[0].trim() !== "cellspacing",
                  );
                if (next) retained.push(`cellspacing:${next}px`);
                updateBlockAttributes(editor, target, {
                  style: retained.join(";"),
                });
                setDraft(null);
              }
            }}
          />
        </label>
      )}
      <TypographyGroup editor={editor} pos={target.pos} />
      {child && <SizeControls editor={editor} pos={target.pos} />}
      <LayoutControls
        editor={editor}
        pos={target.pos}
        groups={{ background: false, border: false }}
      />
    </div>
  );
}
