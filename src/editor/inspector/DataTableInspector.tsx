import { Switch } from "@base-ui/react/switch";
import type { Editor } from "@tiptap/core";
import {
  type BlockTarget,
  dispatchBlockTransaction,
  resolveBlock,
  updateBlockAttributes,
} from "../blocks/commands";
import {
  DATA_TABLE_THEME_DEFAULTS,
  readDataTableTheme,
  tableThemeFields,
} from "../blocks/data-table";
import { ColorField } from "../controls/ColorField";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { documentColors, documentInput } from "./style-adapter";
import { TypographyGroup } from "./TypographyGroup";
export function DataTableInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const block = resolveBlock(editor, target);
  if (!block) return null;
  if (target.nodeType !== "dataTable")
    return (
      <div className="inspector-content">
        <InspectorHeading>
          <InspectorNodeTitle type={target.nodeType}>
            {target.nodeType === "dataTableRow" ? "Table Row" : "Table Cell"}
          </InspectorNodeTitle>
        </InspectorHeading>
      </div>
    );
  const theme = readDataTableTheme(editor);
  const setColor = (index: number, value: string | undefined) => {
    if (!resolveBlock(editor, target)) return;
    const [, , prop, label] = tableThemeFields[index];
    const reference = tableThemeFields[index][1];
    const global = editor.state.doc.firstChild;
    if (!global) return;
    const data = global.attrs.data;
    const styles = structuredClone(data.styles) as {
      id: string;
      title: string;
      inputs: Record<string, unknown>[];
    }[];
    let panel = styles.find((p) => p.id === "data-table-theme");
    if (!panel) {
      panel = { id: "data-table-theme", title: "Table", inputs: [] };
      styles.push(panel);
    }
    panel.inputs = panel.inputs.filter(
      (i) => i.classReference !== reference || i.prop !== prop,
    );
    if (value !== undefined)
      panel.inputs.push({
        label,
        type: "color",
        classReference: reference,
        prop,
        value,
      });
    dispatchBlockTransaction(
      editor,
      editor.state.tr.setNodeMarkup(0, undefined, {
        ...global.attrs,
        data: { ...data, styles },
      }),
      false,
    );
  };
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type={target.nodeType}>Table</InspectorNodeTitle>
      </InspectorHeading>
      <section className="table-section">
        <h3>Table</h3>
        <div className="table-controls">
          <div className="control-row">
            <span>Borders</span>
            <fieldset className="segmented" aria-label="Borders">
              {Object.entries({
                all: "All",
                horizontal: "Rows",
                none: "None",
              }).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={block.node.attrs.borders === value}
                  onClick={() =>
                    updateBlockAttributes(editor, target, { borders: value })
                  }
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
          {(
            [
              ["headerRow", "Header row"],
              ["headerColumn", "Header column"],
              ["striped", "Striped rows"],
            ] as const
          ).map(([key, label]) => (
            <div className="control-row" key={key}>
              <label htmlFor={`table-${key}`}>{label}</label>
              <Switch.Root
                id={`table-${key}`}
                nativeButton
                render={<button type="button" />}
                className="inspector-switch"
                aria-label={label}
                checked={block.node.attrs[key]}
                onCheckedChange={(checked) =>
                  updateBlockAttributes(editor, target, { [key]: checked })
                }
              >
                <Switch.Thumb className="inspector-switch-thumb" />
              </Switch.Root>
            </div>
          ))}
          <div className="table-theme-controls">
            <p>All tables in this email</p>
            {tableThemeFields.map(([key, reference, prop, label], index) => {
              const own = documentInput(editor, reference, prop)?.value;
              return (
                <ColorField
                  key={key}
                  editor={editor}
                  label={label}
                  value={own ? String(own) : undefined}
                  placeholder={
                    own ? DATA_TABLE_THEME_DEFAULTS[key] : theme[key]
                  }
                  presets={documentColors(editor)}
                  onChange={(value) => setColor(index, value)}
                  allowAlpha
                />
              );
            })}
          </div>
        </div>
      </section>
      <TypographyGroup editor={editor} pos={target.pos} />
      <LayoutControls
        editor={editor}
        pos={target.pos}
        groups={{ background: false, border: false }}
      />
    </div>
  );
}
