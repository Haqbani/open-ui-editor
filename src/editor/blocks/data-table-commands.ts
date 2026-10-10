import type { Editor } from "@tiptap/core";
import { Fragment, type Node } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";
import {
  type BlockTarget,
  dispatchBlockTransaction,
  resolveBlock,
  resolveBlockTarget,
} from "./commands";
export type DataTableCommand =
  | "rowBefore"
  | "rowAfter"
  | "columnBefore"
  | "columnAfter"
  | "deleteRow"
  | "deleteColumn"
  | "deleteTable";
export function tableContext(editor: Editor, target: BlockTarget) {
  const r = resolveBlock(editor, target);
  if (!r) return null;
  if (r.node.type.name === "dataTable")
    return { table: r.node, tablePos: target.pos, row: 0, column: 0 };
  const $pos = editor.state.doc.resolve(target.pos + 1);
  for (let d = $pos.depth; d > 0; d--)
    if ($pos.node(d).type.name === "dataTable")
      return {
        table: $pos.node(d),
        tablePos: $pos.before(d),
        row: $pos.index(d),
        column: $pos.depth > d + 1 ? $pos.index(d + 1) : 0,
      };
  return null;
}
export function cellPosition(
  table: Node,
  tablePos: number,
  row: number,
  column: number,
) {
  let pos = tablePos + 2;
  for (let i = 0; i < row; i++) pos += table.child(i).nodeSize;
  for (let i = 0; i < column; i++) pos += table.child(row).child(i).nodeSize;
  return pos;
}
export function runDataTableCommand(
  editor: Editor,
  target: BlockTarget,
  command: DataTableCommand,
): boolean {
  const context = tableContext(editor, target);
  if (!context) return false;
  const { table, tablePos, row, column } = context;
  const count = table.firstChild?.childCount ?? 0;
  if (!count) return false;
  if (
    (command.startsWith("row") && table.childCount >= 50) ||
    (command.startsWith("column") && count >= 8)
  )
    return false;
  const tr = editor.state.tr;
  if (
    command === "deleteTable" ||
    (command === "deleteRow" && table.childCount === 1) ||
    (command === "deleteColumn" && count === 1)
  ) {
    const $pos = tr.doc.resolve(tablePos);
    if (!$pos.parent.canReplace($pos.index(), $pos.index() + 1)) return false;
    tr.delete(tablePos, tablePos + table.nodeSize);
    tr.setSelection(
      Selection.near(
        tr.doc.resolve(Math.min(tablePos, tr.doc.content.size - 1)),
      ),
    );
  } else {
    const rows: Node[] = [];
    table.forEach((r) => {
      rows.push(r);
    });
    const emptyCell = (align: string | null = null) =>
      editor.schema.nodes.dataTableCell.createChecked(
        { align },
        editor.schema.nodes.paragraph.createChecked(),
      );
    if (command === "rowBefore" || command === "rowAfter")
      rows.splice(
        row + (command === "rowAfter" ? 1 : 0),
        0,
        editor.schema.nodes.dataTableRow.createChecked(
          null,
          Array.from({ length: count }, (_, i) =>
            emptyCell(table.firstChild?.child(i).attrs.align),
          ),
        ),
      );
    if (command === "deleteRow") rows.splice(row, 1);
    if (
      command === "columnBefore" ||
      command === "columnAfter" ||
      command === "deleteColumn"
    )
      for (let i = 0; i < rows.length; i++) {
        const cells: Node[] = [];
        rows[i].forEach((c) => {
          cells.push(c);
        });
        if (command === "deleteColumn") cells.splice(column, 1);
        else
          cells.splice(
            column + (command === "columnAfter" ? 1 : 0),
            0,
            emptyCell(),
          );
        rows[i] = rows[i].copy(Fragment.fromArray(cells));
      }
    const next = table.type.createChecked(
      { ...table.attrs, columns: rows[0].childCount },
      rows,
    );
    tr.replaceWith(tablePos, tablePos + table.nodeSize, next);
    tr.setSelection(
      TextSelection.near(
        tr.doc.resolve(
          cellPosition(
            next,
            tablePos,
            Math.min(row, rows.length - 1),
            Math.min(column, rows[0].childCount - 1),
          ) + 1,
        ),
      ),
    );
  }
  return dispatchBlockTransaction(editor, tr);
}
export function setDataTableColumnAlignment(
  editor: Editor,
  target: BlockTarget,
  alignment: "left" | "center" | "right",
): boolean {
  if (!["left", "center", "right"].includes(alignment)) return false;
  const c = tableContext(editor, target);
  if (!c) return false;
  const tr = editor.state.tr;
  c.table.forEach((row, _offset, index) => {
    const pos = cellPosition(c.table, c.tablePos, index, c.column);
    const cell = row.child(c.column);
    tr.setNodeMarkup(pos, undefined, { ...cell.attrs, align: alignment });
    cell.forEach((child, offset) => {
      const key = "align" in child.attrs ? "align" : "alignment";
      if (key in child.attrs)
        tr.setNodeMarkup(pos + 1 + offset, undefined, {
          ...child.attrs,
          [key]: child.isTextblock ? null : alignment,
        });
    });
  });
  return dispatchBlockTransaction(editor, tr);
}
export function navigateDataTable(editor: Editor, backward = false): boolean {
  const target = resolveBlockTarget(editor);
  if (!target) return false;
  const c = tableContext(editor, target);
  if (!c) return false;
  const columns = c.table.firstChild?.childCount ?? 0;
  if (!columns) return false;
  const index = c.row * columns + c.column + (backward ? -1 : 1);
  if (index < 0) return false;
  if (index === c.table.childCount * columns) {
    if (c.table.childCount >= 50) return false;
    if (!runDataTableCommand(editor, target, "rowAfter")) return false;
  }
  const table = editor.state.doc.nodeAt(c.tablePos);
  if (!table) return false;
  const pos = cellPosition(
    table,
    c.tablePos,
    Math.floor(index / columns),
    index % columns,
  );
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.near(editor.state.doc.resolve(pos + 1)),
    ),
  );
  return true;
}
