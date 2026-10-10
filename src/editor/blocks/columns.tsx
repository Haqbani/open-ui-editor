import {
  ColumnsColumn,
  FourColumns,
  ThreeColumns,
  TwoColumns,
} from "@react-email/editor/extensions";
import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  type BlockTarget,
  dispatchBlockTransaction,
  resolveBlock,
} from "./commands";
export const columnsExtensions = {
  twoColumns: TwoColumns.extend({
    addCommands() {
      return {};
    },
  }),
  threeColumns: ThreeColumns,
  fourColumns: FourColumns,
  columnsColumn: ColumnsColumn,
};
export function createColumnsDocument(count: 2 | 3 | 4): JSONContent {
  return {
    type: { 2: "twoColumns", 3: "threeColumns", 4: "fourColumns" }[count],
    content: Array.from({ length: count }, () => ({
      type: "columnsColumn",
      content: [{ type: "paragraph" }],
    })),
  };
}
export function insertLayoutDocument(
  editor: Editor,
  target: BlockTarget | null,
  document: JSONContent,
): boolean {
  if (!target) return false;
  const r = resolveBlock(editor, target);
  if (!r) return false;
  for (let d = r.$pos.depth; d > 0; d--)
    if (r.$pos.node(d).type.name === "dataTableCell") return false;
  const node = editor.schema.nodeFromJSON(document);
  if (!r.parent.canReplace(r.index + 1, r.index + 1, Fragment.from(node)))
    return false;
  const pos = target.pos + r.node.nodeSize;
  const tr = editor.state.tr.insert(pos, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).setStoredMarks(
    null,
  );
  return dispatchBlockTransaction(editor, tr);
}
