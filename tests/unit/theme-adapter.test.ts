import { EDITOR_THEMES, stylesToCss } from "@react-email/editor/plugins";
import { expect, test } from "vitest";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { toEmailPanels } from "../../src/editor/theme-adapter";
import type { RuntimeThemePanel } from "../../src/editor/types";

const panels: RuntimeThemePanel[] = [
  {
    id: "container",
    title: "Container",
    classReference: "container",
    inputs: [
      {
        label: "Width",
        type: "number",
        value: 600,
        prop: "width",
        classReference: "container",
        unit: "px",
      },
      {
        label: "Padding",
        type: "number",
        value: 0,
        prop: "paddingTop",
        classReference: "container",
        unit: "px",
      },
      {
        label: "Alignment",
        type: "select",
        value: "center",
        prop: "align",
        classReference: "container",
        options: { left: "Left", center: "Center", right: "Right" },
      },
      {
        label: "Inherited",
        type: "number",
        prop: "paddingRight",
        classReference: "container",
        unit: "px",
      },
      {
        label: "Automatic",
        type: "text",
        value: "",
        prop: "height",
        classReference: "container",
      },
    ],
  },
  {
    id: "typography",
    title: "Typography",
    classReference: "body",
    inputs: [
      {
        label: "Font size",
        type: "number",
        value: 14,
        prop: "fontSize",
        classReference: "body",
        unit: "px",
      },
      {
        label: "Line height",
        type: "number",
        value: 155,
        prop: "lineHeight",
        classReference: "container",
        unit: "%",
      },
    ],
  },
];

// Break caught: numeric coercion prevents package unit conversion; arrays lose shipped select maps.
test("preservesNumericUnits", () => {
  const adapted = toEmailPanels(panels);
  expect(adapted).toEqual(panels);
  expect(adapted[0].inputs[0].value).toBe(600);
  expect(adapted[0].inputs[1].value).toBe(0);
  expect(adapted[0].inputs[2].options).toEqual({
    left: "Left",
    center: "Center",
    right: "Right",
  });
  expect(adapted[0].inputs[3].value).toBeUndefined();
  expect(adapted[0].inputs[4].value).toBe("");
  const css = stylesToCss(adapted, "basic");
  expect(css.body.fontSize).toBe("1em");
  expect(css.container.lineHeight).toBe("155%");
  expect(css.container.width).toBe("600px");
  expect(css.container.paddingTop).toBe("0px");
});
test("creates independent serializable output", () => {
  const input = structuredClone(panels);
  const adapted = toEmailPanels(input);
  expect(JSON.parse(JSON.stringify(adapted))).toEqual(input);
  adapted[0].inputs[0].value = 300;
  expect(input[0].inputs[0].value).toBe(600);
});
test("neutral Basic styles render white body, centered white 600px container and 14px/155% typography", () => {
  const doc = createReferenceDocument();
  expect(doc).toMatchObject({
    type: "doc",
    content: [{ type: "globalContent" }, { type: "container" }],
  });
  const css = stylesToCss(
    toEmailPanels(doc.content![0].attrs!.data.styles),
    "basic",
  );
  expect(css.body.backgroundColor).toBe("#ffffff");
  expect(css.body.fontSize).toBe("1em");
  expect(css.container).toMatchObject({
    backgroundColor: "#ffffff",
    align: "center",
    width: "600px",
    lineHeight: "155%",
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
  });
  expect(doc.content![0].attrs!.data.styles).toEqual(EDITOR_THEMES.basic);
});
test.each([
  { value: Number.NaN },
  { value: () => "bad" },
  { options: ["left"] },
  { headerSlot: { type: "span" } },
  { unit: "invented" },
  { prop: "unknownProperty" },
  { classReference: "unknownComponent" },
])(
  "rejects invalid theme inputs instead of dropping persisted data: %j",
  (invalid) => {
    const input = structuredClone(panels);
    Object.assign(input[0].inputs[0], invalid);
    expect(() => toEmailPanels(input)).toThrow();
  },
);

// Break caught: string coercion allows array/object discriminators across the typed adapter.
test.each([
  { malformedType: ["number"] },
  { malformedType: ["color"] },
  { malformedType: { value: "number" } },
])("rejects non-string theme discriminator %j", ({ malformedType }) => {
  const input = structuredClone(panels);
  Object.assign(input[0].inputs[0], { type: malformedType });
  expect(() => toEmailPanels(input)).toThrow(/\$\[0\]\.inputs\[0\]\.type/);
});
