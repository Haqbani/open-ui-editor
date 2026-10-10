import type { Editor } from "@tiptap/core";
import {
  cssDeclaration,
  documentInput,
  documentPanels,
  writeDocumentStyles,
} from "../inspector/style-adapter";
import { BorderFields } from "./BorderFields";
export function ThemeBorderFields({
  editor,
  component,
  panelId,
  radiusPlaceholder = "5",
}: {
  editor: Editor;
  component: string;
  panelId?: string;
  radiusPlaceholder?: string;
}) {
  const raw = cssDeclaration("");
  for (const input of documentPanels(editor).flatMap((panel) => panel.inputs)) {
    if (
      input.classReference !== component ||
      !input.prop.startsWith("border") ||
      input.value === undefined ||
      input.value === ""
    )
      continue;
    raw.setProperty(
      input.prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      `${input.value}${typeof input.value === "number" ? (input.unit ?? "px") : ""}`,
    );
  }
  return (
    <BorderFields
      editor={editor}
      raw={raw}
      radiusPlaceholder={radiusPlaceholder}
      onChange={(changes) =>
        writeDocumentStyles(
          editor,
          component,
          Object.entries(changes).map(([key, value]) => {
            const prop = key.replace(/-([a-z])/g, (_, c: string) =>
              c.toUpperCase(),
            );
            const scalar = value?.match(/^(-?\d*\.?\d+)px$/);
            return {
              prop,
              value: scalar ? Number(scalar[1]) : value,
              unit: scalar
                ? "px"
                : documentInput(editor, component, prop)?.unit,
            };
          }),
          panelId,
        )
      }
    />
  );
}
