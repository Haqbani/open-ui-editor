import { EmailNode } from "@react-email/editor/core";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { createBlockRevisionPlugin } from "../../src/editor/blocks/commands";
import { createDataTableDocument } from "../../src/editor/blocks/data-table";
import {
  insertToolbarAt,
  registerToolbarCommand,
} from "../../src/editor/blocks/toolbar-drop";
import { createDocumentContract } from "../../src/editor/document-contract";
import { createEditorExtensions } from "../helpers/extensions";

function session(content: JSONContent[], inline = false) {
  const extensions = createEditorExtensions();
  if (inline)
    extensions.push(
      EmailNode.create({
        name: "testVariable",
        group: "inline",
        inline: true,
        atom: true,
        addAttributes: () => ({ id: { default: null } }),
        renderToReactEmail: ({ node }) => String(node.attrs?.id),
      }),
    );
  const { schema } = createDocumentContract(extensions);
  let state = EditorState.create({
    schema,
    plugins: [createBlockRevisionPlugin()],
    doc: schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "globalContent",
          attrs: { data: { theme: "basic", css: "", styles: [] } },
        },
        { type: "container", content },
      ],
    }),
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
test("block drop inserts an empty new list instead of converting pointer text", () => {
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "Keep me" }] },
  ]);
  expect(insertToolbarAt(editor, "text:bullet-list", 2, 0)).toBe(true);
  expect(editor.state.doc.nodeAt(2)?.textContent).toBe("");
  expect(editor.state.doc.textContent).toBe("Keep me");
  const before = editor.getJSON();
  expect(insertToolbarAt(editor, "text:paragraph", 2, 0)).toBe(false);
  expect(editor.getJSON()).toEqual(before);
});
test("inline registration seam inserts at pointer caret preserving both text fragments", () => {
  const editor = session(
    [{ type: "paragraph", content: [{ type: "text", text: "Neutral body" }] }],
    true,
  );
  const unregister = registerToolbarCommand(editor, "var:neutral", {
    inline: true,
    create: () => ({ type: "testVariable", attrs: { id: "{{{NEUTRAL}}}" } }),
  });
  expect(insertToolbarAt(editor, "var:neutral", 9, 0, true)).toBe(true);
  const p = editor.state.doc.nodeAt(2)!;
  expect(p.child(0).text).toBe("Neutra");
  expect(p.child(1).attrs.id).toBe("{{{NEUTRAL}}}");
  expect(p.child(2).text).toBe("l body");
  unregister();
});
test("unknown, outside, text-block and cell drop destinations reject", () => {
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "Keep" }] },
    createDataTableDocument(),
  ]);
  const before = editor.getJSON();
  for (const [id, pos] of [
    ["missing", 2],
    ["text:paragraph", 0],
    ["text:paragraph", 4],
    ["text:paragraph", 10],
  ] as const)
    expect(insertToolbarAt(editor, id, pos, 0)).toBe(false);
  expect(editor.getJSON()).toEqual(before);
});
test("direct container nodeAfter and end nodeBefore preserve both midpoint sides", async () => {
  const { toolbarBlockTarget } = await import(
    "../../src/editor/blocks/toolbar-drop"
  );
  const { vi } = await import("vitest");
  class ElementRect {
    getBoundingClientRect() {
      return { left: 0, right: 500, top: 100, bottom: 140 };
    }
  }
  vi.stubGlobal("HTMLElement", ElementRect);
  try {
    for (const boundary of ["atom", "end"]) {
      const editor = session([
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "horizontalRule" },
      ]);
      const hr = 2 + editor.state.doc.nodeAt(2)!.nodeSize;
      const hit = boundary === "atom" ? hr : hr + 1;
      Object.assign(editor.view, {
        dom: {
          getBoundingClientRect: () => ({
            left: 0,
            right: 500,
            top: 0,
            bottom: 600,
          }),
        },
        posAtCoords: () => ({ pos: hit, inside: hr }),
        nodeDOM: () => new ElementRect(),
      });
      expect(toolbarBlockTarget(editor, 100, 105)).toEqual({
        pos: hr,
        anchorPos: hr,
        side: "before",
        parentPos: 1,
      });
      expect(toolbarBlockTarget(editor, 100, 135)).toEqual({
        pos: hr + 1,
        anchorPos: hr,
        side: "after",
        parentPos: 1,
      });
      expect(toolbarBlockTarget(editor, -1, 105)).toBeNull();
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

test("retained native drop plugin accepts drag started after helper module reload", async () => {
  const { vi } = await import("vitest");
  const { NodeSelection } = await import("@tiptap/pm/state");
  const original = await import("../../src/editor/blocks/toolbar-drop");
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "Move" }] },
    { type: "paragraph", content: [{ type: "text", text: "After" }] },
  ]);
  const pos = 2;
  const next = pos + editor.state.doc.nodeAt(pos)!.nodeSize;
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
  );
  class ElementRect {
    getBoundingClientRect() {
      return { left: 0, right: 500, top: 100, bottom: 140 };
    }
  }
  vi.stubGlobal("HTMLElement", ElementRect);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const timeout = vi
    .spyOn(globalThis, "setTimeout")
    .mockReturnValue(0 as never);
  const focus = vi.spyOn(editor.view, "focus");
  Object.defineProperty(editor.view, "state", { get: () => editor.state });
  Object.assign(editor.view, {
    dom: {
      getBoundingClientRect: () => ({
        left: 0,
        right: 500,
        top: 0,
        bottom: 600,
      }),
    },
    posAtCoords: () => ({ pos: next + 1, inside: next }),
    nodeDOM: () => new ElementRect(),
  });
  const plugins = original.ToolbarDrop.config.addProseMirrorPlugins!.call({
    editor,
  } as never);
  const drop = plugins[0].props.handleDrop!;
  const slice = editor.state.selection.content();
  try {
    // Retain the mounted plugin/editor; only the exported UI helper is reloaded.
    vi.resetModules();
    const refreshed = await import("../../src/editor/blocks/toolbar-drop");
    const before = editor.getJSON();
    refreshed.beginNativeBlockDrag(editor, {
      pos,
      type: "paragraph",
      revision: 1,
    });
    const event = {
      clientX: 100,
      clientY: 135,
      preventDefault() {},
    } as DragEvent;
    drop.call(plugins[0], editor.view, event, slice, true);
    expect(editor.getJSON()).toEqual(before);
    refreshed.beginNativeBlockDrag(editor, {
      pos,
      type: "paragraph",
      revision: 0,
    });
    drop.call(plugins[0], editor.view, event, slice, true);
    expect(editor.state.doc.child(1).child(0).textContent).toBe("After");
    expect(editor.state.doc.child(1).child(1).textContent).toBe("Move");
    expect(focus).not.toHaveBeenCalled();
  } finally {
    focus.mockRestore();
    timeout.mockRestore();
    vi.unstubAllGlobals();
  }
});
