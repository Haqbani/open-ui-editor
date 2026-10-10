import type { Editor, JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { createColumnsDocument } from "../../src/editor/blocks/columns";
import {
  createBlockRevisionPlugin,
  resolveBlockTarget,
} from "../../src/editor/blocks/commands";
import { createDataTableDocument } from "../../src/editor/blocks/data-table";
import {
  runDataTableCommand,
  setDataTableColumnAlignment,
} from "../../src/editor/blocks/data-table-commands";
import {
  createDocumentContract,
  validateDocument,
} from "../../src/editor/document-contract";
import { createEditorExtensions } from "../helpers/extensions";

const wrap = (content: JSONContent[]) => ({
  type: "doc",
  content: [
    {
      type: "globalContent",
      attrs: { data: { theme: "basic", css: "", styles: [] } },
    },
    { type: "container", content },
  ],
});
function session(table = createDataTableDocument()) {
  const extensions = createEditorExtensions();
  const { schema } = createDocumentContract(extensions);
  let state = EditorState.create({
    schema,
    plugins: [createBlockRevisionPlugin()],
    doc: schema.nodeFromJSON(wrap([table, { type: "paragraph" }])),
  });
  return {
    get state() {
      return state;
    },
    schema,
    options: { extensions },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
      focus() {},
    },
    getJSON: () => state.doc.toJSON(),
  } as unknown as Editor;
}
for (const count of [2, 3, 4] as const)
  test(`${count} columns are exact empty siblings`, () => {
    const node = createColumnsDocument(count);
    expect(node.content).toHaveLength(count);
    for (const column of node.content!)
      expect(column).toEqual({
        type: "columnsColumn",
        content: [{ type: "paragraph" }],
      });
    expect(
      validateDocument(
        wrap([node]),
        createDocumentContract(createEditorExtensions()),
      ).ok,
    ).toBe(true);
  });
test("DataTable defaults and grammar", () => {
  const table = createDataTableDocument();
  const editor = session(table);
  const node = editor.state.doc.nodeAt(2)!;
  expect(node.attrs).toMatchObject({
    headerRow: true,
    headerColumn: false,
    borders: "all",
    striped: false,
    columns: 3,
  });
  expect(node.childCount).toBe(3);
  expect(node.child(0).childCount).toBe(3);
  table.content![0].content![0].content = [
    { type: "heading", attrs: { level: 1 } },
  ];
  expect(
    validateDocument(
      wrap([table]),
      createDocumentContract(createEditorExtensions()),
    ).ok,
  ).toBe(false);
});
test("caps and stale targets reject without mutation", () => {
  const editor = session();
  const stale = resolveBlockTarget(editor, 4)!;
  for (let i = 3; i < 8; i++)
    expect(
      runDataTableCommand(
        editor,
        resolveBlockTarget(editor, 4)!,
        "columnAfter",
      ),
    ).toBe(true);
  expect(
    runDataTableCommand(editor, resolveBlockTarget(editor, 4)!, "columnAfter"),
  ).toBe(false);
  expect(runDataTableCommand(editor, stale, "deleteTable")).toBe(false);
  for (let i = 3; i < 50; i++)
    expect(
      runDataTableCommand(editor, resolveBlockTarget(editor, 4)!, "rowAfter"),
    ).toBe(true);
  expect(
    runDataTableCommand(editor, resolveBlockTarget(editor, 4)!, "rowAfter"),
  ).toBe(false);
});
test("column alignment inherits through rows and deletion stays rectangular", () => {
  const editor = session();
  expect(
    setDataTableColumnAlignment(
      editor,
      resolveBlockTarget(editor, 4)!,
      "center",
    ),
  ).toBe(true);
  expect(
    runDataTableCommand(editor, resolveBlockTarget(editor, 4)!, "rowBefore"),
  ).toBe(true);
  editor.state.doc.nodeAt(2)!.forEach((row) => {
    expect(row.child(0).attrs.align).toBe("center");
  });
  for (let i = 3; i > 1; i--)
    expect(
      runDataTableCommand(
        editor,
        resolveBlockTarget(editor, 4)!,
        "deleteColumn",
      ),
    ).toBe(true);
  editor.state.doc.nodeAt(2)!.forEach((row) => {
    expect(row.childCount).toBe(1);
  });
  expect(
    runDataTableCommand(editor, resolveBlockTarget(editor, 4)!, "deleteColumn"),
  ).toBe(true);
  expect(editor.state.doc.nodeAt(2)!.type.name).toBe("paragraph");
});
test("reject ragged, oversized and span-bearing data without silent flattening", () => {
  const contract = createDocumentContract(createEditorExtensions());
  for (const mutate of [
    (t: JSONContent) => t.content![0].content!.pop(),
    (t: JSONContent) => (t.content![0].content![0].attrs = { colspan: 2 }),
    (t: JSONContent) =>
      (t.content = Array.from({ length: 51 }, () => t.content![0])),
  ]) {
    const t = createDataTableDocument();
    mutate(t);
    expect(validateDocument(wrap([t]), contract).ok).toBe(false);
  }
});
test("headers stripes borders alignment and theme survive actual email composition", async () => {
  const { Editor } = await import("@tiptap/core");
  const { composeReactEmail } = await import("@react-email/editor/core");
  const table = createDataTableDocument();
  table.attrs = {
    ...table.attrs,
    headerRow: false,
    headerColumn: true,
    borders: "horizontal",
    striped: true,
  };
  table.content!.forEach((row) => {
    row.content![0].attrs = { align: "center" };
  });
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: wrap([table]),
  });
  const html = (await composeReactEmail({ editor })).html;
  expect(html.match(/scope="row"/g)).toHaveLength(3);
  expect(html).toContain("text-align:center");
  expect(html).toContain("#f4f4f5");
  expect(html).toContain("#fafafa");
  expect(html).toContain("border-bottom:1px solid #e4e4e7");
  expect(html).toContain("2px 12px");
});

test("legacy span input is diagnosed rather than flattened by public Column serializer", () => {
  const doc = wrap([
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: "2" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    },
  ]);
  const result = validateDocument(
    doc,
    createDocumentContract(createEditorExtensions()),
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(
      result.issues.some(
        (i) => i.path.endsWith("colspan") && i.message.includes("span-aware"),
      ),
    ).toBe(true);
});
