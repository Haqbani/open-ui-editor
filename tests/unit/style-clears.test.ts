import { Editor } from "@tiptap/core";
import { afterEach, expect, test } from "vitest";
import {
  createDocumentContract,
  validateDocument,
} from "../../src/editor/document-contract";
import { serializeEmail } from "../../src/editor/export/serialize-email";
import {
  documentInput,
  writeDocumentStyles,
} from "../../src/editor/inspector/style-adapter";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { createEditorExtensions } from "../helpers/extensions";

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});
// Own undefined properties are lost during serialization; inspect live data first.
for (const prop of [
  "width",
  "backgroundColor",
  "paddingTop",
  "borderLeftColor",
]) {
  test(`clearedDocumentStyleRemainsLiveExportable:${prop}`, async () => {
    const extensions = createEditorExtensions();
    const editor = new Editor({
      element: null,
      extensions,
      content: createReferenceDocument(),
    });
    editors.push(editor);
    writeDocumentStyles(editor, "container", [{ prop, value: undefined }]);
    expect(
      Object.hasOwn(documentInput(editor, "container", prop)!, "value"),
    ).toBe(false);
    expect(
      validateDocument(editor.getJSON(), createDocumentContract(extensions)).ok,
    ).toBe(true);
    const result = await serializeEmail(editor, "Clear preview", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.html).toContain("Template title");
    expect(result.text).toContain("Section content");
  });
}
test("documentStyleClearRetainsExplicitZeroAndAutomatic", async () => {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: createReferenceDocument(),
  });
  editors.push(editor);
  writeDocumentStyles(editor, "container", [
    { prop: "paddingTop", value: 0 },
    { prop: "height", value: "" },
    { prop: "width", value: undefined },
  ]);
  expect(documentInput(editor, "container", "paddingTop")?.value).toBe(0);
  expect(documentInput(editor, "container", "height")?.value).toBe("");
  expect((await serializeEmail(editor, "", 1)).ok).toBe(true);
});
