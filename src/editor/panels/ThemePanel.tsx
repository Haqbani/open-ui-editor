import {
  EDITOR_THEMES,
  getPanelTitle,
  getThemeBodyFontSizePx,
  RESET_THEMES,
  resolveResetValue,
  SUPPORTED_CSS_PROPERTIES,
} from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef } from "react";
import { ChoiceField } from "../controls/ChoiceField";
import { ColorField } from "../controls/ColorField";
import { NumericField } from "../controls/NumericField";
import { type SideValues, SideValuesField } from "../controls/SideValuesField";
import { ThemeBorderFields } from "../controls/ThemeBorderFields";
import { globalGroups } from "../inspector/group-contract";
import {
  documentColors,
  documentPanels,
  writeDocumentStyles,
} from "../inspector/style-adapter";
import {
  currentTheme,
  resetEditorThemeGroup,
  selectTheme,
  themeGroupDirty,
  themeRenderPanels,
} from "../inspector/theme-operations";
import { Icon } from "../shell/icons";
import type { RuntimeThemePanel } from "../types";

export function ThemePanel({
  editor,
  request,
}: {
  editor: Editor;
  request: { group?: string; key: number } | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const theme = currentTheme(editor),
    panels = documentPanels(editor);
  useEffect(() => {
    if (!request || !host.current) return;
    host.current.scrollTop = 0;
    if (request.group)
      host.current
        .querySelector(`[data-section="${CSS.escape(request.group)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [request]);
  return (
    <div className="overlay-content theme-content" ref={host}>
      <div className="theme-choices">
        {Object.keys(EDITOR_THEMES).map((name) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={theme === name}
            onClick={() => selectTheme(editor, name as "basic" | "minimal")}
          >
            {name}
          </button>
        ))}
      </div>
      {themeRenderPanels(panels, theme)
        .filter((panel) => globalGroups[panel.id])
        .map((panel) => {
          const title = getPanelTitle(
            panel as Parameters<typeof getPanelTitle>[0],
          );
          return (
            <section
              className="theme-group"
              data-section={title}
              key={panel.id}
            >
              <header>
                <h3>
                  {[
                    "h1",
                    "h2",
                    "h3",
                    "paragraph",
                    "list",
                    "nested-list",
                    "list-item",
                  ].includes(panel.id) ? (
                    <>
                      <span className="theme-label-prefix">Text / </span>
                      {title}
                    </>
                  ) : (
                    title
                  )}
                </h3>
                {
                  <button
                    type="button"
                    aria-label={`Reset ${title} to default`}
                    aria-disabled={!themeGroupDirty(panels, theme, panel.id)}
                    onClick={() => {
                      if (themeGroupDirty(panels, theme, panel.id))
                        resetEditorThemeGroup(editor, panel.id);
                    }}
                  >
                    <Icon name="Reset" size={14} />
                  </button>
                }
              </header>
              <ThemeFields editor={editor} panel={panel} />
            </section>
          );
        })}
    </div>
  );
}
function ThemeFields({
  editor,
  panel,
}: {
  editor: Editor;
  panel: RuntimeThemePanel;
}) {
  const theme = currentTheme(editor),
    groups = globalGroups[panel.id];
  const inputs = panel.inputs;
  const component = panel.classReference ?? panel.id;
  const reset =
    RESET_THEMES[theme][component as keyof typeof RESET_THEMES.basic];
  const read = (prop: string) => inputs.find((i) => i.prop === prop)?.value;
  const classFor = (prop: string) =>
    inputs.find((i) => i.prop === prop)?.classReference ?? component;
  const write = (
    prop: string,
    value: string | number | undefined,
    unit?: string,
  ) =>
    writeDocumentStyles(
      editor,
      classFor(prop),
      [{ prop, value, unit }],
      panel.id,
    );
  const fallback = (prop: string, unit: "px" | "%" = "px") => {
    const definition =
      SUPPORTED_CSS_PROPERTIES[prop as keyof typeof SUPPORTED_CSS_PROPERTIES];
    const raw = reset?.[prop as keyof typeof reset];
    return String(
      resolveResetValue(raw, unit, getThemeBodyFontSizePx(theme)) ??
        definition?.defaultValue ??
        "",
    );
  };
  const number = (label: string, prop: string, unit: "px" | "%" = "px") => (
    <NumericField
      label={label}
      value={typeof read(prop) === "number" ? Number(read(prop)) : undefined}
      unit={unit}
      placeholder={fallback(prop, unit)}
      min={prop === "fontSize" ? 0 : undefined}
      onChange={(v) => write(prop, v, unit)}
    />
  );
  const color = (label: string, prop: string) => (
    <ColorField
      editor={editor}
      label={label}
      value={typeof read(prop) === "string" ? String(read(prop)) : undefined}
      placeholder={String(
        reset?.[prop as keyof typeof reset] ??
          (prop === "color" ? "#000000" : ""),
      )}
      presets={documentColors(editor)}
      allowAlpha
      onChange={(v) => write(prop, v)}
    />
  );
  const sides = (prefix: "padding" | "border", corners = false) => {
    const keys = ["top", "right", "bottom", "left"] as const;
    const props = corners
      ? [
          "borderTopLeftRadius",
          "borderTopRightRadius",
          "borderBottomRightRadius",
          "borderBottomLeftRadius",
        ]
      : keys.map((key) =>
          prefix === "padding"
            ? `padding${key[0].toUpperCase()}${key.slice(1)}`
            : `border${key[0].toUpperCase()}${key.slice(1)}Width`,
        );
    const uniform = corners ? "borderRadius" : "borderWidth";
    const values = Object.fromEntries(
      keys.map((key, i) => [
        key,
        read(props[i]) ?? (prefix === "border" ? read(uniform) : 0),
      ]),
    ) as SideValues;
    return (
      <SideValuesField
        label={
          corners
            ? "Corner radius"
            : prefix === "padding"
              ? "Padding"
              : "Border"
        }
        value={values}
        corners={corners}
        inherited={
          Object.fromEntries(
            keys.map((key, i) => [
              key,
              Number(fallback(prefix === "padding" ? props[i] : uniform)) || 0,
            ]),
          ) as SideValues
        }
        onChange={(next, side) => {
          if (prefix === "border" && !side) {
            write(uniform, next.top, "px");
            return;
          }
          writeDocumentStyles(
            editor,
            component,
            keys.flatMap((key, i) =>
              prefix === "padding" || !side || key === side
                ? [{ prop: props[i], value: next[key], unit: "px" }]
                : [],
            ),
            panel.id,
          );
        }}
      />
    );
  };
  return (
    <>
      {groups.includes("background") && color("Background", "backgroundColor")}
      {groups.includes("text") && (
        <div className="theme-typography">
          {color("Color", "color")}
          {number("Size", "fontSize")}
          <div className="control-row">
            <span>Weight</span>
            <ChoiceField
              label="Weight"
              value={String(read("fontWeight") ?? reset?.fontWeight ?? 400)}
              options={{
                300: "Light",
                400: "Regular",
                600: "Semi Bold",
                700: "Bold",
                800: "Extra Bold",
              }}
              onChange={(value) => write("fontWeight", value)}
            />
          </div>
          {number("Height", "lineHeight", "%")}
          {number("Spacing", "letterSpacing")}
          <div className="control-row">
            <span>Decoration</span>
            <div className="segmented">
              {[
                ["none", "None"],
                ["underline", "Underline"],
                ["line-through", "Strikethrough"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={label}
                  aria-pressed={
                    (read("textDecoration") ??
                      reset?.textDecoration ??
                      "none") === v
                  }
                  onClick={() => write("textDecoration", v)}
                >
                  {v === "none" ? "Aa" : <Icon name={label} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {groups.includes("padding") && sides("padding")}
      {groups.includes("border") && (
        <ThemeBorderFields
          editor={editor}
          component={component}
          panelId={panel.id}
          radiusPlaceholder={fallback("borderRadius")}
        />
      )}
    </>
  );
}
