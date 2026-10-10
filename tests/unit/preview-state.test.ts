import * as composer from "@react-email/editor/core";
import { EmailNode } from "@react-email/editor/core";
import { Editor, Extension, Node } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { afterEach, expect, test, vi } from "vitest";
import {
  acceptPreview,
  type PreviewState,
} from "../../src/editor/export/preview-state";
import {
  type ExportResult,
  serializeEmail,
} from "../../src/editor/export/serialize-email";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { createEditorExtensions } from "../helpers/extensions";

vi.mock("@react-email/editor/core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@react-email/editor/core")>();
  return { ...actual, composeReactEmail: vi.fn(actual.composeReactEmail) };
});

const editors: Editor[] = [];
function makeEditor(
  extra: ReturnType<typeof createEditorExtensions> = [],
  probe?: string,
) {
  const content = createReferenceDocument();
  if (probe)
    content.content![1].content = [
      { type: probe, content: [{ type: "text", text: "Must not disappear" }] },
    ];
  const editor = new Editor({
    element: null,
    extensions: [...createEditorExtensions(), ...extra],
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const editor of editors.splice(0)) editor.destroy();
});

test("lateExportDoesNotReplaceLatestPreview", () => {
  const current: PreviewState = { requestedRevision: 2, result: null };
  const old: ExportResult = {
    ok: true,
    revision: 1,
    html: "<p>Old</p>",
    unformattedHtml: "<p>Old</p>",
    text: "Old",
  };
  expect(acceptPreview(current, old)).toBe(current);
  expect(acceptPreview(current, { ...old, revision: 2 }).result).toMatchObject({
    revision: 2,
  });
});
test("staleFailureDoesNotReplaceLatestPreview", () => {
  const result: ExportResult = {
    ok: true,
    revision: 2,
    html: "New",
    unformattedHtml: "New",
    text: "New",
  };
  const current: PreviewState = { requestedRevision: 2, result };
  const failure: ExportResult = {
    ok: false,
    revision: 1,
    issues: [{ path: "$", code: "invalid-node", message: "Changed" }],
  };
  expect(acceptPreview(current, failure)).toBe(current);
  expect(acceptPreview(current, { ...failure, revision: 2 }).result?.ok).toBe(
    false,
  );
  expect(acceptPreview(current, { ...result, revision: 3 })).toBe(current);
});
test("exportsNeutralDocumentWithoutEditorChrome", async () => {
  const editor = makeEditor();
  const result = await serializeEmail(editor, "Neutral preview", 4);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.revision).toBe(4);
  for (const html of [result.html, result.unformattedHtml]) {
    for (const text of [
      "Welcome",
      "Template title",
      "Section content",
      "https://example.com",
      "600px",
      'role="presentation"',
      "Neutral preview",
    ])
      expect(html).toContain(text);
    expect(html).toMatch(/<h1[\s>]/);
    expect(html).not.toMatch(
      /ProseMirror|contenteditable|data-node-view|editor-inspector|insertion-palette/,
    );
  }
  expect(result.text).toContain("Welcome");
  expect(result.text).toContain("TEMPLATE TITLE");
  expect(result.text).toContain("Section content");
  expect(result.text).toContain("https://example.com");
});
test("unsupportedTypeFailsBeforeSerializer", async () => {
  const Plain = Node.create({
    name: "plainExportProbe",
    group: "block",
    content: "inline*",
    parseHTML: () => [{ tag: "probe" }],
    renderHTML: () => ["probe", 0],
  });
  const editor = makeEditor([Plain], Plain.name);
  const compose = vi.spyOn(composer, "composeReactEmail");
  expect(await serializeEmail(editor, "", 5)).toMatchObject({
    ok: false,
    revision: 5,
    issues: [
      { path: "$.content[1].content[0].type", code: "unsupported-node" },
    ],
  });
  expect(compose).not.toHaveBeenCalled();
});
test("rendererExceptionsResolveDiagnosticsAndRemoveListeners", async () => {
  const Broken = EmailNode.create({
    name: "brokenExportProbe",
    group: "block",
    content: "inline*",
    renderToReactEmail() {
      throw new Error("Intentional renderer failure");
    },
  });
  const editor = makeEditor([Broken], Broken.name);
  const on = vi.spyOn(editor, "on");
  const off = vi.spyOn(editor, "off");
  expect(await serializeEmail(editor, "", 6)).toMatchObject({
    ok: false,
    revision: 6,
    issues: [
      {
        path: "$",
        code: "invalid-node",
        message: "Intentional renderer failure",
      },
    ],
  });
  const handler = on.mock.calls.find(([event]) => event === "transaction")?.[1];
  expect(handler).toBeTypeOf("function");
  expect(off).toHaveBeenCalledWith("transaction", handler);
});
test("documentChangeDuringRenderingRejectsMixedExport", async () => {
  const editor = makeEditor();
  const pending = serializeEmail(editor, "", 7);
  const changed = createReferenceDocument();
  changed.content![0].attrs!.data.css = "h1 { color: red; }";
  editor.commands.setContent(changed, { emitUpdate: false });
  expect(await pending).toMatchObject({
    ok: false,
    revision: 7,
    issues: [{ code: "invalid-node" }],
  });
});
test("changeThenRestoreWithoutUpdateStillRejectsExport", async () => {
  const editor = makeEditor();
  const original = editor.getJSON();
  const updates = vi.fn();
  editor.on("update", updates);
  const pending = serializeEmail(editor, "", 8);
  const changed = createReferenceDocument();
  changed.content![1].content![0].content![0].text = "Changed";
  editor.commands.setContent(changed, { emitUpdate: false });
  editor.commands.setContent(original, { emitUpdate: false });
  expect(editor.getJSON()).toEqual(original);
  expect(updates).not.toHaveBeenCalled();
  expect(await pending).toMatchObject({
    ok: false,
    revision: 8,
    issues: [{ code: "invalid-node" }],
  });
});
test("selectionOnlyChangeAllowsExport", async () => {
  const editor = makeEditor();
  const pending = serializeEmail(editor, "", 9);
  editor.commands.setTextSelection(3);
  expect(await pending).toMatchObject({ ok: true, revision: 9 });
});
test("appendedDocumentChangeRejectsExport", async () => {
  const Appender = Extension.create({
    name: "exportAppender",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          appendTransaction(transactions, _old, state) {
            if (transactions.some((tr) => tr.getMeta("export-probe")))
              return state.tr.insertText("Appended", 3);
            return null;
          },
        }),
      ];
    },
  });
  const editor = makeEditor([Appender]);
  // Unmounted Node editors start without plugins; install the real public plugin state for this case.
  editor.view.updateState(
    editor.state.reconfigure({ plugins: editor.extensionManager.plugins }),
  );
  const pending = serializeEmail(editor, "", 10);
  editor.view.dispatch(editor.state.tr.setMeta("export-probe", true));
  expect(editor.state.doc.textContent).toContain("Appended");
  expect(await pending).toMatchObject({
    ok: false,
    revision: 10,
    issues: [{ code: "invalid-node" }],
  });
});
test("destroyDuringExportResolvesDiagnostic", async () => {
  const editor = makeEditor();
  const pending = serializeEmail(editor, "", 11);
  editor.destroy();
  expect(await pending).toMatchObject({
    ok: false,
    revision: 11,
    issues: [{ code: "invalid-node" }],
  });
});
