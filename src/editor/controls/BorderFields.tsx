import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { colorHex, documentColors, numeric } from "../inspector/style-adapter";
import { Icon } from "../shell/icons";
import { ChoiceField } from "./ChoiceField";
import { ColorField } from "./ColorField";
import { NumericField } from "./NumericField";
import { SideValuesField } from "./SideValuesField";

const sides = ["top", "right", "bottom", "left"] as const;
export function BorderFields({
  editor,
  raw,
  onChange,
  radiusPlaceholder = "0",
  defaults,
}: {
  editor: Editor;
  raw: CSSStyleDeclaration;
  onChange: (changes: Record<string, string | undefined>) => void;
  radiusPlaceholder?: string;
  defaults?: CSSStyleDeclaration;
}) {
  const get = (side: string, property: string) =>
    raw.getPropertyValue(`border-${side}-${property}`) ||
    raw.getPropertyValue(`border-${property}`) ||
    defaults?.getPropertyValue(`border-${side}-${property}`) ||
    defaults?.getPropertyValue(`border-${property}`);
  const [individual, setIndividual] = useState(() =>
    sides.some((side) =>
      ["width", "color", "style"].some(
        (prop) => get(side, prop) !== get("top", prop),
      ),
    ),
  );
  const radiusKeys = [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ];
  const radius = Object.fromEntries(
    sides.map((side, i) => [
      side,
      numeric(
        raw.getPropertyValue(radiusKeys[i]) ||
          defaults?.getPropertyValue(radiusKeys[i]),
      ),
    ]),
  ) as import("./SideValuesField").SideValues;
  const toggle = (next: boolean) => {
    if (next === individual) return;
    const values: Record<string, string | undefined> = {};
    if (next) {
      for (const prop of ["width", "color", "style"])
        values[`border-${prop}`] = undefined;
      for (const side of sides)
        for (const prop of ["width", "color", "style"])
          values[`border-${side}-${prop}`] =
            get(side, prop) ||
            { width: "1px", color: "#000000", style: "solid" }[prop];
    } else {
      for (const side of sides)
        for (const prop of ["width", "color", "style"])
          values[`border-${side}-${prop}`] = undefined;
      for (const prop of ["width", "color", "style"])
        values[`border-${prop}`] =
          get("top", prop) ||
          { width: "1px", color: "#000000", style: "solid" }[prop];
    }
    onChange(values);
    setIndividual(next);
  };
  const toggles = (
    <div className="segmented">
      <button
        type="button"
        aria-label="Unified Border"
        aria-pressed={!individual}
        onClick={() => toggle(false)}
      >
        <Icon name="Uniform" />
      </button>
      <button
        type="button"
        aria-label="Individual Border"
        aria-pressed={individual}
        onClick={() => toggle(true)}
      >
        <Icon name="Per side" />
      </button>
    </div>
  );
  return (
    <>
      <SideValuesField
        label="Corner radius"
        corners
        value={radius}
        inherited={{
          top: Number(radiusPlaceholder),
          right: Number(radiusPlaceholder),
          bottom: Number(radiusPlaceholder),
          left: Number(radiusPlaceholder),
        }}
        onChange={(next, side) => {
          if (side && next[side] === undefined) {
            onChange({ "border-radius": undefined });
            return;
          }
          const values = sides.map((key) => next[key] ?? 0);
          onChange({
            "border-radius": Object.values(next).every((v) => v === undefined)
              ? undefined
              : values.every((v) => v === values[0])
                ? `${values[0]}px`
                : (values[1] === values[3]
                    ? values[0] === values[2]
                      ? values.slice(0, 2)
                      : values.slice(0, 3)
                    : values
                  )
                    .map((v) => `${v}px`)
                    .join(" "),
          });
        }}
      />
      <div className="control-row">
        <span>Border</span>
        <div className="side-toolbar">
          {!individual && (
            <NumericField
              compact
              label="Border"
              unit="px"
              min={0}
              value={numeric(raw.borderWidth || defaults?.borderWidth)}
              placeholder="1"
              onChange={(value) =>
                onChange({
                  "border-width":
                    value === undefined ? undefined : `${value}px`,
                })
              }
            />
          )}{" "}
          {toggles}
        </div>
      </div>
      {individual ? (
        <div className="border-sides">
          {sides.map((side) => (
            <div className="border-side-row" key={side}>
              <NumericField
                compact
                label={`Border ${side}`}
                unit="px"
                min={0}
                value={numeric(get(side, "width"))}
                placeholder="1"
                onChange={(value) =>
                  onChange({
                    [`border-${side}-width`]:
                      value === undefined ? undefined : `${value}px`,
                  })
                }
              />
              <ChoiceField
                label={`Border ${side} style`}
                value={get(side, "style") || "solid"}
                options={{
                  solid: "Solid",
                  dashed: "Dashed",
                  dotted: "Dotted",
                  double: "Double",
                  none: "None",
                }}
                onChange={(value) =>
                  onChange({ [`border-${side}-style`]: value })
                }
              />
              <ColorField
                editor={editor}
                label={`Border ${side} color`}
                placeholder="None"
                value={colorHex(get(side, "color")) ?? "#000000"}
                presets={documentColors(editor)}
                allowAlpha
                onChange={(value) =>
                  onChange({ [`border-${side}-color`]: value })
                }
              />
              <button
                type="button"
                aria-label={`Clear border ${side}`}
                onClick={() =>
                  onChange(
                    Object.fromEntries(
                      ["width", "style", "color"].map((prop) => [
                        `border-${side}-${prop}`,
                        undefined,
                      ]),
                    ),
                  )
                }
              >
                <Icon name="Clear color" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <ColorField
          editor={editor}
          label="Border color"
          placeholder="None"
          value={
            colorHex(raw.borderColor || defaults?.borderColor) ?? "#000000"
          }
          allowAlpha
          presets={documentColors(editor)}
          onChange={(value) => onChange({ "border-color": value })}
        />
      )}
    </>
  );
}
