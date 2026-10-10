import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { TypographyControls } from "../controls/TypographyControls";
import { Icon } from "../shell/icons";
import { groupProperties, nodeGroups } from "./group-contract";
import { nodeGroupDefaults } from "./node-group-state";
import { blockStyles, commitNodeStyles } from "./style-adapter";
export function TypographyGroup({
  editor,
  pos,
}: {
  editor: Editor;
  pos: number;
}) {
  const node = editor.state.doc.nodeAt(pos);
  const config = nodeGroups[node?.type.name ?? ""];
  const [added, setAdded] = useState(false);
  const { raw } = blockStyles(editor, pos);
  const defaults = nodeGroupDefaults(editor, pos);
  if (!config || ![...config.expanded, ...config.collapsed].includes("text"))
    return null;
  const expanded =
    config.expanded.includes("text") ||
    added ||
    groupProperties.text.some(
      (prop) => raw.getPropertyValue(prop) || defaults.getPropertyValue(prop),
    );
  return (
    <section className="inspector-section">
      <h3 className="control-group-heading">
        Typography
        {config.collapsed.includes("text") && (
          <button
            type="button"
            aria-label={`${expanded ? "Remove" : "Add"} Typography`}
            onClick={() => {
              if (expanded)
                commitNodeStyles(
                  editor,
                  pos,
                  Object.fromEntries(
                    groupProperties.text.map((prop) => [prop, undefined]),
                  ),
                  node,
                );
              setAdded(!expanded);
            }}
          >
            <Icon name={expanded ? "Remove Spacing" : "Add Background"} />
          </button>
        )}
      </h3>
      {expanded && <TypographyControls editor={editor} pos={pos} section />}
    </section>
  );
}
