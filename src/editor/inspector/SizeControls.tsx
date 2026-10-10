import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { NumericField } from "../controls/NumericField";
import { Icon } from "../shell/icons";
import { nodeGroups } from "./group-contract";
import { blockStyles, commitNodeStyles, numeric } from "./style-adapter";
export function SizeControls({
  editor,
  pos,
  onAttributesChange,
}: {
  editor: Editor;
  pos: number;
  onAttributesChange?: (change: Record<string, unknown>) => void;
}) {
  const node = editor.state.doc.nodeAt(pos);
  const { raw } = blockStyles(editor, pos);
  const attributes = node && ["image", "youtube"].includes(node.type.name);
  const [added, setAdded] = useState(false);
  const widthSource = String(
    attributes ? node?.attrs.width : raw.width,
  ).endsWith("%")
    ? "%"
    : "px";
  const heightSource = !attributes && raw.height.endsWith("%") ? "%" : "px";
  const [widthUnit, setWidthUnit] = useState<"px" | "%">(widthSource);
  const [heightUnit, setHeightUnit] = useState<"px" | "%">(heightSource);
  useEffect(() => setWidthUnit(widthSource), [widthSource]);
  useEffect(() => setHeightUnit(heightSource), [heightSource]);
  if (!node) return null;
  const config = nodeGroups[node.type.name];
  if (!config || ![...config.expanded, ...config.collapsed].includes("size"))
    return null;
  const read = (prop: "width" | "height") =>
    attributes ? node.attrs[prop] : raw[prop];
  const shown =
    added ||
    config.expanded.includes("size") ||
    ["width", "height"].some((prop) => {
      const value = read(prop as "width" | "height");
      return value !== null && value !== undefined && value !== "";
    });
  const write = (changes: Record<string, string | number | null>) => {
    if (onAttributesChange) {
      onAttributesChange(changes);
      return;
    }
    if (editor.state.doc.nodeAt(pos) !== node) return;
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      ...changes,
    });
    if (editor.state.selection instanceof NodeSelection)
      tr.setSelection(NodeSelection.create(tr.doc, pos));
    editor.view.dispatch(tr);
  };
  const remove = () => {
    if (attributes) write({ width: null, height: null });
    commitNodeStyles(
      editor,
      pos,
      { width: undefined, height: undefined, "box-sizing": undefined },
      attributes ? undefined : node,
    );
    setAdded(false);
  };
  return (
    <section className="inspector-section">
      <h3 className="control-group-heading">
        Size
        {config.collapsed.includes("size") && (
          <button
            type="button"
            aria-label={`${shown ? "Remove" : "Add"} Size`}
            onClick={() => (shown ? remove() : setAdded(true))}
          >
            <Icon name={shown ? "Remove Spacing" : "Add Background"} />
          </button>
        )}
      </h3>
      {shown &&
        (["width", "height"] as const).map((prop) => (
          <NumericField
            key={prop}
            label={prop === "width" ? "Width" : "Height"}
            unit={prop === "width" ? widthUnit : heightUnit}
            units
            unitOptions={attributes && prop === "height" ? ["px"] : undefined}
            value={numeric(String(read(prop) ?? ""))}
            placeholder="auto"
            onChange={(value, unit) => {
              const previous = prop === "width" ? widthUnit : heightUnit;
              (prop === "width" ? setWidthUnit : setHeightUnit)(unit);
              if (previous !== unit && value === undefined) return;
              if (attributes)
                write({
                  [prop]:
                    value === undefined
                      ? prop === "width"
                        ? "auto"
                        : null
                      : unit === "%"
                        ? `${value}%`
                        : value,
                });
              else
                commitNodeStyles(
                  editor,
                  pos,
                  {
                    [prop]: value === undefined ? undefined : `${value}${unit}`,
                    ...(prop === "width" && node.type.name === "columnsColumn"
                      ? { flex: value === undefined ? undefined : "none" }
                      : {}),
                    "box-sizing":
                      value !== undefined ||
                      raw[prop === "width" ? "height" : "width"]
                        ? "border-box"
                        : undefined,
                  },
                  node,
                );
            }}
          />
        ))}
    </section>
  );
}
