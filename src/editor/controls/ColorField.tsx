import { Input } from "@base-ui/react/input";
import { Popover } from "@base-ui/react/popover";
import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import { FloatingInspectorLayer } from "../inspector/InspectorFrame";
import { colorHex } from "../inspector/style-adapter";
import { beginColorGesture } from "../inspector/style-history";
import { Icon } from "../shell/icons";
export function ColorField({
  editor,
  label,
  value,
  onChange,
  allowAlpha,
  placeholder = "#000000",
  disabled = false,
  presets = [],
  onSource,
}: {
  editor: Editor;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allowAlpha: boolean;
  placeholder?: string;
  disabled?: boolean;
  presets?: string[];
  onSource?: () => void;
}) {
  const gesture = useRef<{
    history: ReturnType<typeof beginColorGesture>;
    pointerId: number;
  } | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endGesture = useCallback(() => {
    if (releaseTimer.current !== null) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    gesture.current?.history.end();
    gesture.current = null;
  }, []);
  useEffect(() => {
    const released = (event: PointerEvent) => {
      if (event.pointerId !== gesture.current?.pointerId) return;
      // onChangeEnd owns normal completion after the last picker sample.
      // The next task also releases an unchanged gesture (no onChangeEnd).
      releaseTimer.current = setTimeout(endGesture, 0);
    };
    const canceled = (event: PointerEvent) => {
      if (event.pointerId === gesture.current?.pointerId) endGesture();
    };
    window.addEventListener("pointerup", released);
    window.addEventListener("pointercancel", canceled);
    window.addEventListener("blur", endGesture);
    return () => {
      window.removeEventListener("pointerup", released);
      window.removeEventListener("pointercancel", canceled);
      window.removeEventListener("blur", endGesture);
      endGesture();
    };
  }, [endGesture]);
  const discreteChange = (value: string | undefined) => {
    endGesture();
    onChange(value);
  };
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commitDraft = () => {
    let next = draft.trim();
    if (
      !next.startsWith("#") &&
      /^(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(next)
    )
      next = `#${next}`;
    const normalized =
      /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(next)
        ? colorHex(next)
        : undefined;
    if (normalized && (allowAlpha || normalized.length === 7)) {
      setDraft(normalized);
      if (normalized !== value) discreteChange(normalized);
    } else setDraft(value ?? "");
  };
  const trigger = useRef<HTMLButtonElement>(null);
  const Picker = allowAlpha ? HexAlphaColorPicker : HexColorPicker;
  return (
    <div className="control-row">
      <span>{label}</span>
      <div className="field-surface color-field">
        <Popover.Root
          onOpenChange={(open) => {
            if (!open) {
              endGesture();
              trigger.current?.focus({ preventScroll: true });
            }
          }}
        >
          <Popover.Trigger
            ref={trigger}
            disabled={disabled}
            aria-label={`Choose ${label}`}
            className="color-swatch"
            data-inherited={value === undefined}
            style={{ backgroundColor: value ?? placeholder }}
          />
          <Popover.Portal>
            <Popover.Positioner
              className="control-positioner"
              side="bottom"
              align="end"
              sideOffset={6}
            >
              <EditorFocusScope>
                <Popover.Popup className="color-popup">
                  <FloatingInspectorLayer>
                    <div
                      onPointerDownCapture={(event) => {
                        if (
                          event.button !== 0 ||
                          !event.isPrimary ||
                          gesture.current
                        )
                          return;
                        gesture.current = {
                          history: beginColorGesture(editor),
                          pointerId: event.pointerId,
                        };
                      }}
                      onKeyDownCapture={endGesture}
                    >
                      <Picker
                        onChangeEnd={endGesture}
                        color={colorHex(value ?? placeholder) ?? "#000000"}
                        onChange={(value) => {
                          if (gesture.current)
                            gesture.current.history.apply(() =>
                              onChange(value),
                            );
                          else onChange(value);
                        }}
                      />
                    </div>
                    <p>On this document:</p>
                    <div className="color-presets">
                      {presets.map((color) => (
                        <button
                          type="button"
                          key={color}
                          aria-label={`Use ${color}`}
                          style={{ backgroundColor: color }}
                          onClick={() => discreteChange(color)}
                        />
                      ))}
                    </div>
                  </FloatingInspectorLayer>
                </Popover.Popup>
              </EditorFocusScope>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          data-source={value === undefined ? "inherited" : "local"}
          onValueChange={setDraft}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitDraft();
          }}
        />
        {value !== undefined && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            className="source-arrow"
            onClick={(event) => {
              discreteChange(undefined);
              event.currentTarget
                .closest<HTMLElement>("[data-testid=editor-inspector]")
                ?.focus({ preventScroll: true });
            }}
          >
            <Icon name="Clear color" size={14} />
          </button>
        )}
        {value === undefined && onSource && (
          <button
            type="button"
            aria-label="Go to color source"
            title="Go to color source"
            onClick={onSource}
            className="source-arrow"
          >
            <Icon name="Go to source" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
