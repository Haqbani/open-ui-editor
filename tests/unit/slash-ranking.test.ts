import { Editor, type JSONContent } from "@tiptap/core";
import { history } from "@tiptap/pm/history";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { createColumnsDocument } from "../../src/editor/blocks/columns";
import { createDataTableDocument } from "../../src/editor/blocks/data-table";
import {
  applicationSlashCommands,
  filterApplicationCommands,
} from "../../src/editor/shell/slash-commands";
import { createEditorExtensions } from "../helpers/extensions";

function editorWith(block: JSONContent) {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: {
      type: "doc",
      content: [
        {
          type: "globalContent",
          attrs: { data: { theme: "basic", css: "", styles: [] } },
        },
        { type: "container", content: [block] },
      ],
    },
  });
  let position = 0;
  editor.state.doc.descendants((node, pos) => {
    if (!position && node.type.name === "paragraph") position = pos + 1;
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, position),
    ),
  );
  return editor;
}
test("application ranking retains full source terms and stable columns ties", () => {
  const editor = editorWith({ type: "paragraph" }),
    items = applicationSlashCommands();
  for (const [query, want] of [
    ["tit", ["Title", "Subtitle", "Heading"]],
    ["columns", ["2 columns", "3 columns", "4 columns", "Table"]],
    ["  h2  ", ["Subtitle"]],
    ["/", []],
  ] as const)
    expect(
      filterApplicationCommands(items, query, editor).map((i) => i.title),
    ).toEqual(want);
  editor.destroy();
});
test("layout ancestors alone count towards max depth and Table remains searchable", () => {
  for (const depth of [1, 2, 3]) {
    let node = createColumnsDocument(2);
    for (let i = 1; i < depth; i++)
      node = {
        ...createColumnsDocument(2),
        content: [
          { type: "columnsColumn", content: [node] },
          { type: "columnsColumn", content: [{ type: "paragraph" }] },
        ],
      };
    const editor = editorWith(node);
    expect(
      filterApplicationCommands(
        applicationSlashCommands(),
        "columns",
        editor,
      ).map((i) => i.title),
    ).toEqual(
      depth === 3
        ? ["Table"]
        : ["2 columns", "3 columns", "4 columns", "Table"],
    );
    editor.destroy();
  }
  const editor = editorWith(createDataTableDocument());
  expect(
    filterApplicationCommands(applicationSlashCommands(), "", editor).map(
      (i) => i.title,
    ),
  ).toEqual(["Text", "Image"]);
  expect(
    filterApplicationCommands(applicationSlashCommands(), "heading", editor),
  ).toEqual([]);
  editor.destroy();
});

test("conditional bubble AI context describes the current selection and ancestor blocks", async () => {
  const { getAiPromptContext } = await import(
    "../../src/editor/services/editor-events"
  );
  const editor = editorWith({
    type: "section",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [
          { type: "text", text: "Neutral title", marks: [{ type: "italic" }] },
        ],
      },
    ],
  });
  let start = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") start = pos + 1;
  });
  editor.commands.setTextSelection({ from: start, to: start + 7 });
  expect(getAiPromptContext(editor, "bubble")).toEqual({
    selection: {
      text: "Neutral",
      blockIndex: 1,
      totalBlocks: 2,
      nodeType: "heading",
    },
  });
  editor.commands.setTextSelection({ from: start + 8, to: start + 13 });
  expect(getAiPromptContext(editor, "bubble")).toEqual({
    selection: {
      text: "title",
      blockIndex: 1,
      totalBlocks: 2,
      nodeType: "heading",
    },
  });
  editor.destroy();
});

test("Link Preview source command inserts the actual transient schema node and undoes once", () => {
  const editor = editorWith({ type: "paragraph" });
  editor.registerPlugin(history());
  const before = editor.getJSON();
  expect(editor.commands.insertOgLinkPreview).toBeTypeOf("function");
  expect(editor.commands.insertOgLinkPreview()).toBe(true);
  let preview: JSONContent | undefined;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "ogLinkPreview") preview = node.toJSON();
  });
  expect(preview).toMatchObject({
    type: "ogLinkPreview",
    attrs: {
      internal_pasteId: null,
      internal_linkHref: "",
      internal_isLoading: false,
    },
  });
  expect(editor.commands.undo()).toBe(true);
  expect(editor.getJSON()).toEqual(before);
  editor.destroy();
});

test("slash AI uses visual emptiness for textless blocks and live paragraph range", async () => {
  const { getAiPromptContext } = await import(
    "../../src/editor/services/editor-events"
  );
  for (const type of ["image", "button", "horizontalRule"]) {
    const editor = editorWith({ type: "paragraph" });
    editor.commands.insertContentAt(2, { type });
    let pos = 0;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "paragraph") pos = position + 1;
    });
    editor.commands.setTextSelection(pos);
    expect(editor.state.doc.textContent).toBe("");
    expect(getAiPromptContext(editor, "slash")).toEqual({
      selection: {
        text: "",
        blockIndex: 0,
        totalBlocks: 1,
        nodeType: "paragraph",
      },
      selectionRange: { from: pos - 1, to: pos + 1 },
    });
    editor.destroy();
  }
  const empty = editorWith({ type: "paragraph" });
  expect(getAiPromptContext(empty, "slash")).toEqual({});
  empty.destroy();
});
