import { useState } from "react";
import { Icon } from "../shell/icons";
import { NumericField } from "./NumericField";
export type SideValues = {
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;
};
const sides = ["top", "right", "bottom", "left"] as const;
export function SideValuesField({
  label,
  value,
  onChange,
  inherited,
  split = false,
  corners = false,
  suffixes,
}: {
  label: string;
  value: SideValues;
  onChange: (value: SideValues, side?: keyof SideValues) => void;
  inherited?: SideValues;
  split?: boolean;
  corners?: boolean;
  suffixes?: Partial<Record<keyof SideValues, string>>;
}) {
  const [individual, setIndividual] = useState(
    split || !sides.every((side) => value[side] === value.top),
  );
  const same = sides.every((side) => value[side] === value.top);
  return (
    <div className="side-values">
      <div className="control-row">
        <span>{label}</span>
        <div className="side-toolbar">
          {!individual && (
            <NumericField
              label={label}
              value={same ? value.top : undefined}
              unit="px"
              min={label === "Margin" ? undefined : 0}
              emptyValue={corners ? undefined : 0}
              compact
              placeholder={same ? (inherited?.top?.toString() ?? "") : ""}
              onChange={(v) =>
                onChange({ top: v, right: v, bottom: v, left: v })
              }
            />
          )}
          <div className="segmented">
            <button
              type="button"
              aria-label={`Unified ${label}`}
              aria-pressed={!individual}
              onClick={() => {
                if (individual) {
                  const first = corners
                    ? sides
                        .map((side) => value[side])
                        .find((v) => v !== undefined)
                    : (value.top ?? 0);
                  onChange({
                    top: first,
                    right: first,
                    bottom: first,
                    left: first,
                  });
                }
                setIndividual(false);
              }}
            >
              <Icon name="Uniform" />
            </button>
            <button
              type="button"
              aria-label={`Individual ${label}`}
              aria-pressed={individual}
              onClick={() => setIndividual(true)}
            >
              <Icon name="Per side" />
            </button>
          </div>
        </div>
      </div>
      {individual && (
        <div className="side-grid">
          {sides.map((side) => (
            <NumericField
              key={side}
              label={`${label} ${corners ? ({ top: "top left", right: "top right", bottom: "bottom right", left: "bottom left" })[side] : side}`}
              compact
              value={value[side]}
              min={label === "Margin" ? undefined : 0}
              emptyValue={corners ? undefined : 0}
              icon={corners ? undefined : `Axis ${side}`}
              placeholder={inherited?.[side]?.toString() ?? ""}
              unit="px"
              suffix={suffixes?.[side]}
              onChange={(next) => onChange({ ...value, [side]: next }, side)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
