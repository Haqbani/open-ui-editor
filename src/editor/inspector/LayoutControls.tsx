import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { BorderFields } from "../controls/BorderFields";
import { ColorField } from "../controls/ColorField";
import { SideValuesField } from "../controls/SideValuesField";
import { Icon } from "../shell/icons";
import { groupProperties, nodeGroups } from "./group-contract";
import { nodeGroupDefaults } from "./node-group-state";
import {
  blockStyles,
  colorHex,
  commitNodeStyles,
  documentColors,
  numeric,
  sideChanges,
  sides,
} from "./style-adapter";
export function LayoutControls({
  editor,
  pos,
  background = true,
  border = true,
}: {
  editor: Editor;
  pos: number;
  background?: boolean;
  border?: boolean;
  groups?: { background?: boolean; border?: boolean };
}) {
  const { raw, effective } = blockStyles(editor, pos);
  const node = editor.state.doc.nodeAt(pos);
  const type = node?.type.name ?? "";
  const config = nodeGroups[type] ?? {
    expanded: ["padding"],
    collapsed: ["background", "border"],
  };
  const text = ["paragraph", "heading"].includes(type);
  const [added, setAdded] = useState<string[]>([]);
  const defaults = nodeGroupDefaults(editor, pos);
  const open = (group: keyof typeof groupProperties) =>
    config.expanded.includes(group) ||
    added.includes(group) ||
    groupProperties[group].some(
      (prop) => raw.getPropertyValue(prop) || defaults.getPropertyValue(prop),
    );
  const backgroundOpen = open("background"),
    borderOpen = open("border");
  const remove = (group: keyof typeof groupProperties) => {
    const props =
      group === "padding" && !text
        ? [...groupProperties.padding, ...groupProperties.margin]
        : groupProperties[group];
    commitNodeStyles(
      editor,
      pos,
      Object.fromEntries(props.map((prop) => [prop, undefined])),
      node,
    );
    setAdded((items) => items.filter((item) => item !== group));
  };
  const heading = (
    label: string,
    group: keyof typeof groupProperties,
    shown: boolean,
  ) => (
    <h3 className="control-group-heading">
      {label}
      {(group === "padding" || config.collapsed.includes(group)) && (
        <button
          type="button"
          aria-label={`${shown ? "Remove" : "Add"} ${label}`}
          onClick={() =>
            shown ? remove(group) : setAdded((items) => [...items, group])
          }
        >
          <Icon name={shown ? "Remove Spacing" : "Add Background"} />
        </button>
      )}
    </h3>
  );
  const set = (prop: string, value: string | undefined) =>
    commitNodeStyles(editor, pos, { [prop]: value }, node);
  return (
    <>
      {config.expanded.includes("padding") && (
        <section className="inspector-section">
          {heading("Spacing", "padding", true)}
          <div className="inspector-section-content">
            {config.expanded.includes("padding") &&
              (text
                ? (["padding"] as const)
                : (["padding", "margin"] as const)
              ).map((kind) => (
                <SideValuesField
                  key={kind}
                  label={kind === "padding" ? "Padding" : "Margin"}
                  value={
                    kind === "padding"
                      ? (Object.fromEntries(
                          ["top", "right", "bottom", "left"].map((side) => [
                            side,
                            numeric(
                              raw.getPropertyValue(`padding-${side}`) ||
                                defaults.getPropertyValue(`padding-${side}`),
                            ) ?? 0,
                          ]),
                        ) as ReturnType<typeof sides>)
                      : sides(raw, kind)
                  }
                  suffixes={Object.fromEntries(
                    ["top", "right", "bottom", "left"].map((side) => [
                      side,
                      raw.getPropertyValue(`${kind}-${side}`).endsWith("%")
                        ? "%"
                        : "px",
                    ]),
                  )}
                  onChange={(value, side) =>
                    commitNodeStyles(
                      editor,
                      pos,
                      sideChanges(
                        value,
                        kind,
                        raw,
                        kind === "padding" ? undefined : side,
                      ),
                      node,
                    )
                  }
                />
              ))}
          </div>
        </section>
      )}
      {background &&
        [...config.expanded, ...config.collapsed].includes("background") && (
          <section className="inspector-section">
            {heading("Background", "background", backgroundOpen)}
            {backgroundOpen && (
              <ColorField
                editor={editor}
                presets={documentColors(editor)}
                label="Color"
                value={colorHex(
                  raw.backgroundColor || defaults.backgroundColor || "#ffffff",
                )}
                placeholder="None"
                allowAlpha
                onChange={(value) => set("background-color", value)}
              />
            )}
          </section>
        )}
      {border &&
        [...config.expanded, ...config.collapsed].includes("border") && (
          <section className="inspector-section">
            {heading("Border", "border", borderOpen)}
            {borderOpen && (
              <BorderFields
                editor={editor}
                raw={raw}
                defaults={defaults}
                radiusPlaceholder={String(numeric(effective.borderRadius) ?? 0)}
                onChange={(changes) =>
                  commitNodeStyles(editor, pos, changes, node)
                }
              />
            )}
          </section>
        )}
    </>
  );
}
