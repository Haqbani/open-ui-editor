import { Input } from "@base-ui/react/input";
import { Select } from "@base-ui/react/select";
import { EditorFocusScope } from "@react-email/editor/ui";
import { EditorContext } from "@tiptap/react";
import { useContext, useEffect, useRef, useState } from "react";
import { FloatingInspectorLayer } from "../inspector/InspectorFrame";
import { beginColorGesture } from "../inspector/style-history";
import { Icon } from "../shell/icons";

export type Unit = "px" | "%";
export function NumericField({
  label,
  value,
  unit,
  onChange,
  placeholder,
  units = false,
  compact = false,
  source,
  suffix,
  min,
  onSource,
  unitOptions = ["px", "%"],
  icon,
  emptyValue,
}: {
  label: string;
  value: number | undefined;
  unit: Unit;
  onChange: (value: number | undefined, unit: Unit) => void;
  placeholder?: string;
  units?: boolean;
  compact?: boolean;
  source?: "local" | "inherited" | "automatic";
  suffix?: string;
  min?: number;
  onSource?: () => void;
  unitOptions?: Unit[];
  icon?: string;
  emptyValue?: number;
}) {
  const { editor } = useContext(EditorContext);
  const display = value?.toString() ?? "";
  const [draft, setDraft] = useState(display);
  const focused = useRef(false),
    initial = useRef(display),
    skipBlur = useRef(false);
  const scrub = useRef<{
    x: number;
    start: number;
    history: ReturnType<typeof beginColorGesture> | null;
  } | null>(null);
  const fallback = Number(placeholder) || 0;
  const clamp = (next: number) => Math.max(min ?? -Infinity, next);
  useEffect(() => {
    if (!focused.current) setDraft(display);
  }, [display]);
  useEffect(
    () => () => {
      if (scrub.current) {
        scrub.current.history?.end();
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      }
    },
    [],
  );
  const commit = () => {
    if (draft === initial.current) return;
    const next = draft.trim() === "" ? emptyValue : Number(draft);
    if (next !== undefined && !Number.isFinite(next)) {
      setDraft(display);
      return;
    }
    const clamped = next === undefined ? undefined : clamp(next);
    setDraft(clamped?.toString() ?? "");
    onChange(clamped, unit);
  };
  return (
    <div className={`control-row ${compact ? "compact-field" : ""}`}>
      {!compact && <span>{label}</span>}
      <div className="numeric-group">
        <div className={`field-surface ${icon ? "has-axis-icon" : ""}`}>
          {icon && (
            <span className="numeric-axis">
              <Icon name={icon} size={14} />
            </span>
          )}
          <Input
            aria-label={label}
            inputMode="decimal"
            value={draft}
            placeholder={placeholder}
            data-source={
              source ?? (value === undefined ? "inherited" : "local")
            }
            onValueChange={setDraft}
            onFocus={(event) => {
              focused.current = true;
              initial.current = draft;
              skipBlur.current = false;
              event.currentTarget.select();
            }}
            onBlur={() => {
              focused.current = false;
              if (!skipBlur.current) commit();
              skipBlur.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                if (event.key === "Enter") commit();
                else setDraft(display);
                skipBlur.current = true;
                const scope = event.currentTarget.closest<HTMLElement>(
                  "[data-testid=editor-inspector]",
                );
                event.currentTarget.blur();
                // Retain the public Inspector focus scope after the input itself blurs.
                scope?.focus({ preventScroll: true });
              } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                // Source uses truthiness here: explicit zero with fallback 8 increments to 9.
                const next = clamp(
                  (Number(draft) || fallback || 0) +
                    (event.key === "ArrowUp" ? 1 : -1) *
                      (event.shiftKey ? 10 : 1),
                );
                setDraft(String(next));
                initial.current = String(next);
                onChange(next, unit);
              }
            }}
          />
          {!units && (
            <span
              className="unit-suffix"
              style={
                compact
                  ? undefined
                  : {
                      left: `calc(${(draft || placeholder || "").length}ch + 1.35rem)`,
                      right: "auto",
                    }
              }
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                scrub.current = {
                  x: event.clientX,
                  start:
                    typeof value === "number" && Number.isFinite(value)
                      ? value
                      : fallback,
                  history: editor ? beginColorGesture(editor) : null,
                };
                document.body.style.cursor = "ew-resize";
                document.body.style.userSelect = "none";
              }}
              onPointerMove={(event) => {
                const current = scrub.current;
                if (!current) return;
                const next = clamp(
                  current.start +
                    Math.round((event.clientX - current.x) / 2) *
                      (event.shiftKey ? 10 : 1),
                );
                const write = () => onChange(next, unit);
                if (current.history) current.history.apply(write);
                else write();
              }}
              onPointerUp={() => {
                scrub.current?.history?.end();
                scrub.current = null;
                document.body.style.removeProperty("cursor");
                document.body.style.removeProperty("user-select");
              }}
            >
              {suffix ?? unit}
            </span>
          )}
          {!compact && value !== undefined ? (
            <button
              type="button"
              className="numeric-source"
              aria-label={`Clear ${label}`}
              onClick={() => {
                setDraft("");
                onChange(undefined, unit);
              }}
            >
              <Icon name="Clear color" size={14} />
            </button>
          ) : onSource && placeholder ? (
            <button
              type="button"
              className="numeric-source"
              aria-label="Go to source"
              onClick={onSource}
            >
              <Icon name="Go to source" size={14} />
            </button>
          ) : null}
        </div>
        {units && (
          <Select.Root
            value={unit}
            onValueChange={(next) => {
              if (next) onChange(value, next);
            }}
          >
            <Select.Trigger
              className="unit-select"
              aria-label={`${label} unit`}
            >
              <Select.Value />
              <Icon name="Chevron down" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="control-positioner" sideOffset={4}>
                <EditorFocusScope>
                  <Select.Popup className="control-popup">
                    <FloatingInspectorLayer>
                      {unitOptions.map((item) => (
                        <Select.Item
                          key={item}
                          value={item}
                          className="control-option"
                        >
                          <Select.ItemText>{item}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </FloatingInspectorLayer>
                  </Select.Popup>
                </EditorFocusScope>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        )}
      </div>
    </div>
  );
}
