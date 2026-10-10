import { EmailNode } from "@react-email/editor/core";
import { getGlobalContent } from "@react-email/editor/extensions";
import { EditorFocusScope } from "@react-email/editor/ui";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { DataTableCellEmailContext } from "./email-image-context";

function inlineCssToJs(raw: unknown): CSSProperties {
  return Object.fromEntries(
    String(raw ?? "")
      .split(";")
      .filter((s) => s.includes(":"))
      .map((s) => {
        const index = s.indexOf(":");
        return [
          s
            .slice(0, index)
            .trim()
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
          s.slice(index + 1).trim(),
        ];
      }),
  );
}

import { Menu } from "@base-ui/react/menu";
import {
  type Editor,
  type JSONContent,
  mergeAttributes,
  type NodeViewProps,
} from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import { Children, type CSSProperties, createContext, useContext } from "react";
import { resolveBlockTarget, updateBlockAttributes } from "./commands";
import {
  cellPosition,
  type DataTableCommand,
  navigateDataTable,
  runDataTableCommand,
  setDataTableColumnAlignment,
  tableContext,
} from "./data-table-commands";
export const DATA_TABLE_THEME_DEFAULTS = {
  borderColor: "#e4e4e7",
  headerBackground: "#f4f4f5",
  stripeBackground: "#fafafa",
  cellPadding: "2px 12px",
};
export const tableThemeFields = [
  ["borderColor", "dataTableFrame", "borderColor", "Border"],
  [
    "headerBackground",
    "dataTableHeader",
    "backgroundColor",
    "Header background",
  ],
  [
    "stripeBackground",
    "dataTableStripe",
    "backgroundColor",
    "Stripe background",
  ],
] as const;
export function readDataTableTheme(editor: Editor) {
  const result = { ...DATA_TABLE_THEME_DEFAULTS };
  const panels = (getGlobalContent("styles", editor) ?? []) as {
    inputs?: { classReference: string; prop: string; value?: unknown }[];
  }[];
  for (const [key, reference, prop] of tableThemeFields)
    for (const panel of panels) {
      const input = panel.inputs?.find(
        (i) => String(i.classReference) === reference && i.prop === prop,
      );
      if (typeof input?.value === "string" && input.value.trim())
        result[key] = input.value;
    }
  return result;
}
export function createDataTableDocument(): JSONContent {
  return {
    type: "dataTable",
    attrs: { columns: 3 },
    content: Array.from({ length: 3 }, () => ({
      type: "dataTableRow",
      content: Array.from({ length: 3 }, () => ({
        type: "dataTableCell",
        content: [{ type: "paragraph" }],
      })),
    })),
  };
}
const RowIndex = createContext(0),
  ColumnIndex = createContext(0);
const TableContext = createContext({
  headerRow: true,
  headerColumn: false,
  borders: "all",
  striped: false,
  rowCount: 0,
  theme: DATA_TABLE_THEME_DEFAULTS,
});
function EmailCell({
  node,
  style,
  children,
}: {
  node: JSONContent;
  style: CSSProperties;
  children?: React.ReactNode;
}) {
  const table = useContext(TableContext),
    row = useContext(RowIndex),
    column = useContext(ColumnIndex);
  const header =
    (table.headerRow && row === 0) || (table.headerColumn && column === 0);
  const Tag = header ? "th" : "td";
  const empty =
    node.content?.length === 1 &&
    node.content[0].type === "paragraph" &&
    !node.content[0].content?.length;
  return (
    <Tag
      scope={
        header ? (table.headerRow && row === 0 ? "col" : "row") : undefined
      }
      align={node.attrs?.align ?? undefined}
      style={{
        padding: table.theme.cellPadding,
        verticalAlign: "top",
        textAlign: node.attrs?.align ?? "left",
        fontWeight: header ? 600 : undefined,
        backgroundColor: header
          ? table.theme.headerBackground
          : table.striped && row % 2 === 1
            ? table.theme.stripeBackground
            : undefined,
        ...(table.borders === "all"
          ? { border: `1px solid ${table.theme.borderColor}` }
          : table.borders === "horizontal" && row < table.rowCount - 1
            ? { borderBottom: `1px solid ${table.theme.borderColor}` }
            : {}),
        ...style,
      }}
    >
      <DataTableCellEmailContext.Provider
        value={{ align: node.attrs?.align ?? null }}
      >
        {empty ? "\u00a0" : children}
      </DataTableCellEmailContext.Provider>
    </Tag>
  );
}
export const DataTableCell = EmailNode.create({
  name: "dataTableCell",
  content: "(paragraph | image)+",
  isolating: true,
  addAttributes: () => ({
    align: {
      default: null,
      rendered: false,
      parseHTML: (e) => e.getAttribute("data-align"),
    },
  }),
  parseHTML: () => [{ tag: 'td[data-type="data-table-cell"]', priority: 60 }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "td",
    mergeAttributes(HTMLAttributes, {
      "data-type": "data-table-cell",
      ...(node.attrs.align
        ? {
            "data-align": node.attrs.align,
            style: `text-align:${node.attrs.align}`,
          }
        : {}),
    }),
    0,
  ],
  renderToReactEmail: (props) => <EmailCell {...props} />,
});
export const DataTableRow = EmailNode.create({
  name: "dataTableRow",
  content: "dataTableCell+",
  parseHTML: () => [{ tag: 'tr[data-type="data-table-row"]', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => [
    "tr",
    mergeAttributes(HTMLAttributes, { "data-type": "data-table-row" }),
    0,
  ],
  renderToReactEmail: ({ style, children }) => (
    <tr style={style}>
      {Children.map(children, (child, index) => (
        <ColumnIndex.Provider value={index}>{child}</ColumnIndex.Provider>
      ))}
    </tr>
  ),
});
function tableDom(attrs: Record<string, unknown>) {
  return {
    "data-type": "data-table",
    "data-header-row": String(attrs.headerRow),
    "data-header-column": String(attrs.headerColumn),
    "data-borders": String(attrs.borders),
    "data-striped": String(attrs.striped),
    ...(attrs.columns ? { "data-columns": String(attrs.columns) } : {}),
  };
}
export const DataTable = EmailNode.create({
  name: "dataTable",
  group: "block",
  content: "dataTableRow+",
  isolating: true,
  addStorage: () => ({ themeState: { theme: DATA_TABLE_THEME_DEFAULTS } }),
  onCreate() {
    this.storage.themeState.theme = readDataTableTheme(this.editor);
  },
  onTransaction() {
    this.storage.themeState.theme = readDataTableTheme(this.editor);
  },
  addAttributes: () => ({
    headerRow: {
      default: true,
      rendered: false,
      parseHTML: (e) => e.getAttribute("data-header-row") !== "false",
    },
    headerColumn: {
      default: false,
      rendered: false,
      parseHTML: (e) => e.getAttribute("data-header-column") === "true",
    },
    borders: {
      default: "all",
      rendered: false,
      parseHTML: (e) => e.getAttribute("data-borders") ?? "all",
    },
    striped: {
      default: false,
      rendered: false,
      parseHTML: (e) => e.getAttribute("data-striped") === "true",
    },
    columns: {
      default: null,
      rendered: false,
      parseHTML: (e) => Number(e.getAttribute("data-columns")) || null,
    },
    class: { default: null },
    style: { default: null },
  }),
  parseHTML: () => [{ tag: 'table[data-type="data-table"]', priority: 60 }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "table",
    mergeAttributes(HTMLAttributes, tableDom(node.attrs)),
    ["tbody", {}, 0],
  ],
  addNodeView: () =>
    ReactNodeViewRenderer(DataTableView, { contentDOMElementTag: "tbody" }),
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("dataTableCellClick"),
        props: {
          handleClickOn(view, _pos, node, nodePos, event) {
            if (
              node.type.name !== "dataTableCell" ||
              node.childCount !== 1 ||
              node.firstChild?.type.name !== "paragraph" ||
              node.firstChild.content.size !== 0
            )
              return false;
            if (
              !(event.target instanceof Element) ||
              !event.target.closest('[data-type="data-table-cell"]')
            )
              return false;
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.near(view.state.doc.resolve(nodePos + 1)),
              ),
            );
            view.focus();
            return true;
          },
        },
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => navigateDataTable(this.editor),
      "Shift-Tab": () => navigateDataTable(this.editor, true),
      Backspace: () => {
        if (!this.editor.state.selection.empty) return false;
        const target = resolveBlockTarget(this.editor);
        const c = target && tableContext(this.editor, target);
        const cell =
          c?.table.childCount === 1 && c.table.firstChild?.childCount === 1
            ? c.table.firstChild.firstChild
            : null;
        return !!(
          target &&
          cell?.childCount === 1 &&
          cell.firstChild?.type.name === "paragraph" &&
          cell.firstChild.content.size === 0 &&
          runDataTableCommand(this.editor, target, "deleteTable")
        );
      },
    };
  },
  renderToReactEmail({ node, style, children, extension }) {
    return (
      <TableContext.Provider
        value={{
          headerRow: node.attrs?.headerRow !== false,
          headerColumn: node.attrs?.headerColumn === true,
          borders: node.attrs?.borders ?? "all",
          striped: node.attrs?.striped === true,
          rowCount: node.content?.length ?? 0,
          theme:
            extension.storage.themeState.theme ?? DATA_TABLE_THEME_DEFAULTS,
        }}
      >
        <table
          width="100%"
          border={0}
          cellPadding="0"
          cellSpacing="0"
          className={node.attrs?.class ?? undefined}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            ...style,
            ...inlineCssToJs(node.attrs?.style),
          }}
        >
          <tbody>
            {Children.map(children, (child, index) => (
              <RowIndex.Provider value={index}>{child}</RowIndex.Provider>
            ))}
          </tbody>
        </table>
      </TableContext.Provider>
    );
  },
});
function DataTableView({ editor, node, getPos }: NodeViewProps) {
  const theme = useEditorState({
    editor,
    selector: () => readDataTableTheme(editor),
  });
  const targetAt = (row: number, column: number) => {
    const pos = getPos();
    return pos === undefined
      ? null
      : resolveBlockTarget(editor, cellPosition(node, pos, row, column));
  };
  const run = (row: number, column: number, command: DataTableCommand) => {
    const target = targetAt(row, column);
    if (target) runDataTableCommand(editor, target, command);
  };
  const menu = (kind: "Row" | "Column", index: number) => (
    <Menu.Root key={`${kind}${index}`}>
      <Menu.Trigger
        aria-label={`${kind} options ${index + 1}`}
        className="table-option"
      >
        ⋯
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <EditorFocusScope>
            <Menu.Popup
              className="control-popup"
              aria-label={`${kind} actions`}
            >
              {(kind === "Row"
                ? [
                    ["Insert above", "rowBefore"],
                    ["Insert below", "rowAfter"],
                  ]
                : [
                    ["Insert left", "columnBefore"],
                    ["Insert right", "columnAfter"],
                  ]
              ).map(([label, command]) => (
                <Menu.Item
                  key={label}
                  disabled={
                    kind === "Row"
                      ? node.childCount >= 50
                      : (node.firstChild?.childCount ?? 0) >= 8
                  }
                  className="control-option"
                  onClick={() =>
                    run(
                      kind === "Row" ? index : 0,
                      kind === "Column" ? index : 0,
                      command as DataTableCommand,
                    )
                  }
                >
                  {label}
                </Menu.Item>
              ))}
              {kind === "Column" &&
                (["left", "center", "right"] as const).map((align) => (
                  <Menu.Item
                    key={align}
                    className="control-option"
                    onClick={() => {
                      const target = targetAt(0, index);
                      if (target)
                        setDataTableColumnAlignment(editor, target, align);
                    }}
                  >
                    Align {align}
                  </Menu.Item>
                ))}
              <Menu.Item
                className="control-option"
                onClick={() => {
                  const pos = getPos();
                  const target =
                    pos === undefined ? null : resolveBlockTarget(editor, pos);
                  const key = kind === "Row" ? "headerRow" : "headerColumn";
                  if (target)
                    updateBlockAttributes(editor, target, {
                      [key]: !node.attrs[key],
                    });
                }}
              >
                Header {kind.toLowerCase()}
              </Menu.Item>
              <Menu.Item
                className="control-option"
                onClick={() =>
                  run(
                    kind === "Row" ? index : 0,
                    kind === "Column" ? index : 0,
                    kind === "Row" ? "deleteRow" : "deleteColumn",
                  )
                }
              >
                Delete {kind.toLowerCase()}
              </Menu.Item>
            </Menu.Popup>
          </EditorFocusScope>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
  return (
    <NodeViewWrapper
      className="data-table-wrapper"
      onMouseDownCapture={(event: React.MouseEvent<HTMLDivElement>) => {
        const element =
          event.target instanceof Element
            ? event.target.closest('[data-type="data-table-cell"]')
            : null;
        if (!element || event.button !== 0) return;
        const pos = editor.view.posAtDOM(element, 0);
        const $pos = editor.state.doc.resolve(pos);
        const cell = $pos.parent;
        if (
          cell.type.name !== "dataTableCell" ||
          cell.childCount !== 1 ||
          cell.firstChild?.type.name !== "paragraph" ||
          cell.firstChild.content.size
        )
          return;
        event.preventDefault();
        editor.view.dispatch(
          editor.state.tr.setSelection(
            TextSelection.near(editor.state.doc.resolve(pos + 1)),
          ),
        );
        editor.view.focus();
      }}
      style={
        {
          "--table-border": theme.borderColor,
          "--table-header": theme.headerBackground,
          "--table-stripe": theme.stripeBackground,
        } as CSSProperties
      }
    >
      <div contentEditable={false} className="table-column-options">
        <EditorFocusScope>
          <div>
            {Array.from({ length: node.firstChild?.childCount ?? 0 }, (_, i) =>
              menu("Column", i),
            )}
          </div>
        </EditorFocusScope>
      </div>
      <div contentEditable={false} className="table-row-options">
        <EditorFocusScope>
          <div>
            {Array.from({ length: node.childCount }, (_, i) => menu("Row", i))}
          </div>
        </EditorFocusScope>
      </div>
      <NodeViewContent<"table">
        as="table"
        {...tableDom(node.attrs)}
        className={node.attrs.class ?? undefined}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          ...inlineCssToJs(node.attrs.style),
        }}
      />
      <div contentEditable={false}>
        <EditorFocusScope>
          <div>
            {(node.firstChild?.childCount ?? 0) < 8 && (
              <button
                type="button"
                aria-label="Add column"
                onClick={() =>
                  run(0, (node.firstChild?.childCount ?? 0) - 1, "columnAfter")
                }
              >
                +
              </button>
            )}
            {node.childCount < 50 && (
              <button
                type="button"
                aria-label="Add row"
                onClick={() => run(node.childCount - 1, 0, "rowAfter")}
              >
                +
              </button>
            )}
          </div>
        </EditorFocusScope>
      </div>
    </NodeViewWrapper>
  );
}

/** Per-editor nested storage survives the public extension.storage shallow getter. */
export function createDataTableExtension() {
  const themeState = { theme: { ...DATA_TABLE_THEME_DEFAULTS } };
  return DataTable.extend({ addStorage: () => ({ themeState }) });
}
