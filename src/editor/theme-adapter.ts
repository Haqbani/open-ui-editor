import {
  type PanelGroup,
  RESET_THEMES,
  SUPPORTED_CSS_PROPERTIES,
} from "@react-email/editor/plugins";
import type { DocumentIssue, RuntimeThemePanel } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

/** Validate persisted data before crossing the public package's narrower union types. */
export function collectThemeIssues(
  value: unknown,
  path = "$",
): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const fail = (at: string, message: string) =>
    issues.push({ path: at, code: "invalid-style", message });
  const component = (value: unknown) =>
    typeof value === "string" &&
    (Object.hasOwn(RESET_THEMES.basic, value) ||
      ["dataTableFrame", "dataTableHeader", "dataTableStripe"].includes(value));
  const optionalString = (
    obj: Record<string, unknown>,
    key: string,
    at: string,
  ) => {
    if (obj[key] !== undefined && typeof obj[key] !== "string")
      fail(`${at}.${key}`, "Expected a string.");
  };
  const fields = (obj: Record<string, unknown>, keys: string[], at: string) => {
    for (const key of Object.keys(obj))
      if (!keys.includes(key))
        fail(`${at}.${key}`, "Unsupported persisted theme field.");
  };
  if (!Array.isArray(value)) {
    fail(path, "Expected theme panels to be an array.");
    return issues;
  }
  value.forEach((panel: unknown, index: number) => {
    const at = `${path}[${index}]`;
    if (!record(panel)) {
      fail(at, "Expected a theme panel object.");
      return;
    }
    fields(panel, ["id", "title", "classReference", "category", "inputs"], at);
    for (const key of ["id", "title"])
      if (typeof panel[key] !== "string" || !panel[key])
        fail(`${at}.${key}`, "Expected a nonempty string.");
    optionalString(panel, "category", at);
    if (panel.classReference !== undefined && !component(panel.classReference))
      fail(`${at}.classReference`, "Unknown theme component.");
    if (!Array.isArray(panel.inputs)) {
      fail(`${at}.inputs`, "Expected panel inputs to be an array.");
      return;
    }
    panel.inputs.forEach((input: unknown, inputIndex: number) => {
      const inputPath = `${at}.inputs[${inputIndex}]`;
      if (!record(input)) {
        fail(inputPath, "Expected a theme input object.");
        return;
      }
      fields(
        input,
        [
          "label",
          "type",
          "value",
          "prop",
          "classReference",
          "unit",
          "options",
          "placeholder",
          "category",
        ],
        inputPath,
      );
      if (typeof input.label !== "string")
        fail(`${inputPath}.label`, "Expected a label string.");
      if (
        typeof input.type !== "string" ||
        !["text", "number", "color", "select"].includes(input.type)
      )
        fail(`${inputPath}.type`, "Unsupported input type.");
      if (
        typeof input.prop !== "string" ||
        !Object.hasOwn(SUPPORTED_CSS_PROPERTIES, input.prop)
      )
        fail(`${inputPath}.prop`, "Unsupported theme property.");
      if (!component(input.classReference))
        fail(`${inputPath}.classReference`, "Unknown theme component.");
      if (
        input.value !== undefined &&
        typeof input.value !== "string" &&
        !(typeof input.value === "number" && Number.isFinite(input.value))
      )
        fail(`${inputPath}.value`, "Expected a string or finite number.");
      if (input.unit !== undefined && input.unit !== "px" && input.unit !== "%")
        fail(`${inputPath}.unit`, "Unsupported theme unit.");
      for (const key of ["placeholder", "category"])
        optionalString(input, key, inputPath);
      if (
        input.options !== undefined &&
        (!record(input.options) ||
          Object.values(input.options).some(
            (option) => typeof option !== "string",
          ))
      )
        fail(`${inputPath}.options`, "Expected a string-valued option map.");
    });
  });
  return issues;
}

export function toEmailPanels(panels: RuntimeThemePanel[]): PanelGroup[] {
  const issues = collectThemeIssues(panels);
  if (issues.length)
    throw new Error(
      issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
    );
  // The runtime shape keeps serializable fields only. Preserve number/undefined/empty and
  // object option maps; cast only here, after validating the public union values.
  return structuredClone(panels) as unknown as PanelGroup[];
}
