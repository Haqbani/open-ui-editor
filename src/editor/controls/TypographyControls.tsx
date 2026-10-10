import type { Editor } from "@tiptap/core";
import { blockColorSource } from "../inspector/node-group-state";
import {
  blockStyles,
  colorHex,
  colorRange,
  commitNodeStyles,
  documentColors,
  numeric,
  selectionColor,
  writeSelectionColor,
} from "../inspector/style-adapter";
import { useOverlayPanels } from "../panels/OverlayPanels";
import { Icon } from "../shell/icons";
import { ChoiceField } from "./ChoiceField";
import { ColorField } from "./ColorField";
import { NumericField } from "./NumericField";

export function TypographyControls({
  editor,
  pos,
  section = false,
}: {
  editor: Editor;
  pos: number;
  section?: boolean;
}) {
  const overlay = useOverlayPanels();
  const onSource = () => overlay?.open("theme");
  const expectedNode = editor.state.doc.nodeAt(pos);
  const { raw, effective } = blockStyles(editor, pos);
  const range = colorRange(editor);
  const inheritedColor = blockColorSource(editor, pos);
  const color = section
    ? raw.color || undefined
    : range
      ? selectionColor(editor)
      : undefined;
  const size = Number.parseFloat(effective.fontSize) || 14;
  const lineHeight = Math.round(
    (Number.parseFloat(effective.lineHeight) / size) * 100,
  );
  const fontUnit = raw.fontSize.endsWith("%") ? "%" : "px";
  const fontValue = raw.fontSize
    ? /(?:px|%)$/.test(raw.fontSize)
      ? numeric(raw.fontSize)
      : size
    : undefined;
  const heightUnit = raw.lineHeight.endsWith("px") ? "px" : "%";
  const heightValue = raw.lineHeight
    ? /(?:px|%)$/.test(raw.lineHeight)
      ? numeric(raw.lineHeight)
      : lineHeight
    : undefined;
  const set = (prop: string, value: string | undefined) =>
    commitNodeStyles(editor, pos, { [prop]: value }, expectedNode);
  return (
    <div className="typography-controls">
      <ColorField
        editor={editor}
        presets={documentColors(editor)}
        label="Color"
        value={colorHex(color)}
        placeholder={colorHex(inheritedColor.color)}
        allowAlpha
        onSource={() => {
          if (
            inheritedColor.pos !== undefined &&
            !(section && inheritedColor.pos === pos) &&
            !editor.isActive("link")
          )
            editor.chain().setNodeSelection(inheritedColor.pos).focus().run();
          else onSource();
        }}
        disabled={!section && !range}
        onChange={(value) =>
          section ? set("color", value) : writeSelectionColor(editor, value)
        }
      />
      <NumericField
        label={section ? "Size" : "Font size"}
        onSource={onSource}
        min={0}
        value={fontValue}
        placeholder={Math.floor(size).toString()}
        unit={fontUnit}
        onChange={(v, unit) =>
          set("font-size", v === undefined ? undefined : `${v}${unit}`)
        }
      />
      {section && (
        <div className="control-row">
          <span>Weight</span>
          <ChoiceField
            label="Weight"
            value={raw.fontWeight || effective.fontWeight || "400"}
            options={{
              300: "Light",
              400: "Regular",
              600: "Semi Bold",
              700: "Bold",
              800: "Extra Bold",
            }}
            onChange={(value) => set("font-weight", value)}
          />
        </div>
      )}
      <NumericField
        onSource={onSource}
        label={section ? "Height" : "Line height"}
        value={heightValue}
        placeholder={
          Number.isFinite(lineHeight) ? lineHeight.toString() : "155"
        }
        unit={heightUnit}
        onChange={(v, unit) =>
          set("line-height", v === undefined ? undefined : `${v}${unit}`)
        }
      />
      <NumericField
        onSource={onSource}
        label={section ? "Spacing" : "Letter spacing"}
        value={numeric(raw.letterSpacing)}
        placeholder={
          effective.letterSpacing === "normal"
            ? "0"
            : (numeric(effective.letterSpacing) ?? 0).toString()
        }
        unit="px"
        onChange={(v) =>
          set("letter-spacing", v === undefined ? undefined : `${v}px`)
        }
      />
      {section && (
        <div className="control-row">
          <span>Decoration</span>
          <div className="segmented">
            {[
              ["none", "Aa"],
              ["underline", "U"],
              ["line-through", "S"],
            ].map(([value]) => (
              <button
                type="button"
                key={value}
                aria-label={`Decoration ${value}`}
                aria-pressed={
                  (raw.textDecorationLine || effective.textDecorationLine) ===
                  value
                }
                onClick={() => set("text-decoration", value)}
              >
                {value === "none" ? (
                  "Aa"
                ) : (
                  <Icon
                    name={value === "underline" ? "Underline" : "Strikethrough"}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
