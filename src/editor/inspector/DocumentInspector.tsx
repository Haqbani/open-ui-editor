import type { Editor } from "@tiptap/core";
import { AlignmentField } from "../controls/AlignmentField";
import { ColorField } from "../controls/ColorField";
import { NumericField } from "../controls/NumericField";
import { type SideValues, SideValuesField } from "../controls/SideValuesField";
import { ThemeBorderFields } from "../controls/ThemeBorderFields";
import { useOverlayPanels } from "../panels/OverlayPanels";
import {
  documentColors,
  documentPanels,
  writeDocumentStyles,
} from "./style-adapter";
import { currentTheme, themeRenderPanels } from "./theme-operations";

export function DocumentInspector({ editor }: { editor: Editor }) {
  const overlay = useOverlayPanels();
  const panels = themeRenderPanels(
    documentPanels(editor),
    currentTheme(editor),
  );
  const input = (component: string, prop: string) =>
    panels
      .flatMap((panel) => panel.inputs)
      .find(
        (field) => field.classReference === component && field.prop === prop,
      );
  const value = (component: string, prop: string) =>
    input(component, prop)?.value;
  const color = (
    label: string,
    component: string,
    prop: string,
    placeholder: string,
  ) => (
    <ColorField
      editor={editor}
      presets={documentColors(editor)}
      label={label}
      value={
        value(component, prop) === undefined
          ? undefined
          : String(value(component, prop))
      }
      placeholder={placeholder}
      allowAlpha
      onChange={(v) =>
        writeDocumentStyles(editor, component, [{ prop, value: v }])
      }
    />
  );
  const number = (
    label: string,
    prop: string,
    placeholder: string,
    units = false,
  ) => (
    <NumericField
      label={label}
      value={
        typeof value("container", prop) === "number"
          ? Number(value("container", prop))
          : undefined
      }
      placeholder={placeholder}
      source={value("container", prop) === "" ? "automatic" : undefined}
      unit={input("container", prop)?.unit === "%" ? "%" : "px"}
      units={units}
      onChange={(v, unit) =>
        writeDocumentStyles(editor, "container", [{ prop, value: v, unit }])
      }
    />
  );
  const spacing = (label: string, component: string, prefix: string) => {
    const values = Object.fromEntries(
      ["top", "right", "bottom", "left"].map((side) => {
        const v = value(
          component,
          `${prefix}${side[0].toUpperCase()}${side.slice(1)}`,
        );
        return [
          side,
          typeof v === "number" ? v : prefix === "padding" ? 0 : undefined,
        ];
      }),
    ) as SideValues;
    return (
      <SideValuesField
        label={label}
        value={values}
        inherited={{
          top: undefined,
          right: undefined,
          bottom: undefined,
          left: undefined,
        }}
        suffixes={Object.fromEntries(
          ["top", "right", "bottom", "left"].map((side) => [
            side,
            input(
              component,
              `${prefix}${side[0].toUpperCase()}${side.slice(1)}`,
            )?.unit ?? "px",
          ]),
        )}
        onChange={(next, editedSide) =>
          writeDocumentStyles(
            editor,
            component,
            Object.entries(next)
              .filter(
                ([side]) =>
                  prefix === "padding" || !editedSide || editedSide === side,
              )
              .map(([side, v]) => ({
                prop: `${prefix}${side[0].toUpperCase()}${side.slice(1)}`,
                value: v,
                unit:
                  editedSide && prefix !== "padding"
                    ? (input(
                        component,
                        `${prefix}${side[0].toUpperCase()}${side.slice(1)}`,
                      )?.unit ?? "px")
                    : "px",
              })),
          )
        }
      />
    );
  };
  return (
    <div className="inspector-content document-controls">
      {color("Background", "body", "backgroundColor", "None")}
      {spacing("Page padding", "body", "padding")}
      <h3>Body</h3>
      <AlignmentField
        value={String(value("container", "align") ?? "center")}
        onChange={(v) =>
          writeDocumentStyles(editor, "container", [
            { prop: "align", value: v },
          ])
        }
      />
      {color("Text", "body", "color", "#000000")}
      {color("Background", "container", "backgroundColor", "None")}
      {number("Width", "width", "auto", true)}
      {number("Height", "height", "auto", true)}
      {spacing("Padding", "container", "padding")}
      {spacing("Margin", "container", "margin")}
      <ThemeBorderFields
        editor={editor}
        component="container"
        radiusPlaceholder="8"
      />
      <div className="inspector-later">
        <button type="button" onClick={() => overlay?.open("theme")}>
          Edit theme
        </button>
        <button type="button" onClick={() => overlay?.open("css")}>
          Edit global CSS
        </button>
      </div>
    </div>
  );
}
