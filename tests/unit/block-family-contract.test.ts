import type { Editor, JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import {
  createBlockRevisionPlugin,
  getEditorSessionRevision,
  resolveBlockTarget,
  runBlockAction,
} from "../../src/editor/blocks/commands";
import { createDocumentContract } from "../../src/editor/document-contract";
import { createEditorExtensions } from "../helpers/extensions";

// Headless public ProseMirror state adapter; transactions are applied by the real state.
function session(content: JSONContent[]) {
  const extensions = createEditorExtensions();
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
    options: { extensions },
    schema,
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
      focus() {},
    },
    getJSON: () => state.doc.toJSON(),
  } as unknown as Editor;
}

// A reused position/type must not make an old action mutate the replacement node.
test("staleTargetDoesNotMutate", () => {
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "Current" }] },
  ]);
  const before = editor.getJSON();
  expect(
    runBlockAction(
      editor,
      { pos: 2, type: "paragraph", revision: -1 } as never,
      "duplicate",
    ),
  ).toBe(false);
  expect(editor.getJSON()).toEqual(before);
});

// Duplication must preserve a nested wrapper's descendants, attrs and marks.
test("nestedDuplicateRetainsSubtree", () => {
  const editor = session([
    {
      type: "blockquote",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Nested", marks: [{ type: "bold" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  const subtree = editor.state.doc.nodeAt(3)!.toJSON();
  expect(
    runBlockAction(
      editor,
      { pos: 3, type: "bulletList" } as never,
      "duplicate",
    ),
  ).toBe(true);
  const quote = (editor.getJSON() as JSONContent).content![1].content![0];
  expect(quote.content).toEqual([subtree, subtree]);
});

// Production ordered-list-email.html keeps start=1 and custom start/type styles,
// while omitting alignment. The guard must accept the captured tight attribute.
test("listExportRetainsEvidencedAttrs", async () => {
  const { composeReactEmail } = await import("@react-email/editor/core");
  const { Editor: HeadlessEditor } = await import("@tiptap/core");
  const { validateDocument } = await import(
    "../../src/editor/document-contract"
  );
  const editor = session([
    {
      type: "orderedList",
      attrs: {
        start: 1,
        type: null,
        alignment: "center",
        style: "start:3;type:a",
      },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Neutral title" }],
            },
          ],
        },
      ],
    },
  ]);
  const document = editor.getJSON() as JSONContent;
  document.content![1].content![0].attrs!.tight = true;
  expect(
    validateDocument(document, createDocumentContract(createEditorExtensions()))
      .ok,
  ).toBe(true);
  const mounted = new HeadlessEditor({
    element: null,
    extensions: createEditorExtensions(),
    content: document,
  });
  const output = await composeReactEmail({ editor: mounted });
  expect(output.html).toMatch(/<ol[^>]*start="1"/);
  expect(output.html).toMatch(/<ol[^>]*start:3;type:a/);
  expect(output.html).not.toMatch(/<ol[^>]*text-align:center/);
});

// A doc edit invalidates the target synchronously, before persistence or React effects.
test("sessionRevisionRejectsReplacementImmediately", () => {
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "Before" }] },
  ]);
  const target = resolveBlockTarget(editor, 2)!;
  expect(target).toMatchObject({ revision: 0, nodeType: "paragraph" });
  editor.view.dispatch(editor.state.tr.insertText("!", 3));
  expect(getEditorSessionRevision(editor)).toBe(1);
  const before = editor.getJSON();
  expect(runBlockAction(editor, target, "duplicate")).toBe(false);
  expect(editor.getJSON()).toEqual(before);
  const current = resolveBlockTarget(editor, 2)!;
  editor.view.dispatch(editor.state.tr.setMeta("selectionOnly", true));
  expect(getEditorSessionRevision(editor)).toBe(1);
  expect(runBlockAction(editor, current, "duplicate")).toBe(true);
});

test.each([
  ["orderedList", { tight: "true" }],
  ["orderedList", { start: 1.5 }],
  ["button", { href: 12 }],
  ["codeBlock", { language: {} }],
])(
  "raw %s attributes cannot normalize invalid domains",
  async (type, attrs) => {
    const { validateDocument } = await import(
      "../../src/editor/document-contract"
    );
    const editor = session([{ type: "paragraph" }]);
    const document = editor.getJSON() as JSONContent;
    document.content![1].content = [
      {
        type: type as string,
        attrs,
        ...(type === "orderedList"
          ? {
              content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
            }
          : {}),
      },
    ];
    const result = validateDocument(
      document,
      createDocumentContract(createEditorExtensions()),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining(".attrs.") }),
      ]),
    });
  },
);

test("registryExecutesTheProvidedFreshTargetRatherThanTheOldSelection", async () => {
  const { getBlockDefinitions } = await import(
    "../../src/editor/blocks/registry"
  );
  const editor = session([
    { type: "paragraph", content: [{ type: "text", text: "First" }] },
    { type: "paragraph", content: [{ type: "text", text: "Second" }] },
  ]);
  const target = resolveBlockTarget(editor, 9)!;
  expect(
    getBlockDefinitions()
      .find((def) => def.id === "paragraph")!
      .execute(editor, target),
  ).toBe(true);
  expect(
    (editor.getJSON() as JSONContent).content![1].content!.map(
      (node) => node.content?.[0].text ?? "",
    ),
  ).toEqual(["First", "Second", ""]);
});

test.each([
  "css",
  "go",
  "html",
  "javascript",
  "jsx",
  "json",
  "markdown",
  "php",
  "plaintext",
  "python",
  "ruby",
  "shell",
  "sql",
  "svg",
  "typescript",
])("captured Code language %s exports its content", async (language) => {
  const { Editor: HeadlessEditor } = await import("@tiptap/core");
  const { composeReactEmail } = await import("@react-email/editor/core");
  const document = session([
    {
      type: "codeBlock",
      attrs: { language, theme: "default" },
      content: [{ type: "text", text: "answer=42" }],
    },
  ]).getJSON();
  const editor = new HeadlessEditor({
    element: null,
    extensions: createEditorExtensions(),
    content: document,
  });
  const output = await composeReactEmail({ editor });
  expect(output.html).toContain(`data-language="${language}"`);
  expect(output.text).toContain("answer");
  expect(output.text).toContain("42");
});

test("buttonLinkNormalizationMatchesCapturedValidator", async () => {
  const family = await import("../../src/editor/blocks/basic-family");
  expect(family).toHaveProperty("normalizeButtonLink");
  const normalize = (
    family as unknown as {
      normalizeButtonLink: (value: string) => string | null;
    }
  ).normalizeButtonLink;
  for (const [input, output] of [
    ["https://example.com/path", "https://example.com/path"],
    ["example.com", "https://example.com/"],
    ["#", "#"],
    ["{{{DESTINATION}}}", "{{{DESTINATION}}}"],
    ["mailto:hello@example.com", "mailto:hello@example.com"],
    ["javascript:alert(1)", null],
    ["java\nscript:alert(1)", null],
    ["//example.com", "https://example.com/"],
    ["invalid destination", null],
    ["data:image/png;base64,neutral", "data:image/png;base64,neutral"],
    ["data:text/html,neutral", null],
  ])
    expect(normalize(input as string)).toBe(output);
});

test("turnIntoResetsCapturedBlockStyles", async () => {
  const { turnIntoTextFamily } = await import(
    "../../src/editor/blocks/text-family"
  );
  const editor = session([
    {
      type: "heading",
      attrs: { level: 1, style: "padding-top: 12px" },
      content: [{ type: "text", text: "Colored" }],
    },
  ]);
  expect(
    turnIntoTextFamily(editor, resolveBlockTarget(editor, 2)!, "blockquote"),
  ).toBe(true);
  expect(editor.state.doc.nodeAt(2)!.firstChild!.attrs.style).toBeFalsy();
});

test("turnIntoTextRetainsCapturedInlineColor", async () => {
  const { turnIntoTextFamily } = await import(
    "../../src/editor/blocks/text-family"
  );
  const editor = session([
    {
      type: "heading",
      attrs: { level: 1 },
      content: [
        {
          type: "text",
          text: "Colored",
          marks: [
            { type: "preservedStyle", attrs: { style: "color: #123456" } },
          ],
        },
      ],
    },
  ]);
  const marks = editor.state.doc.nodeAt(2)!.firstChild!.marks;
  expect(
    turnIntoTextFamily(editor, resolveBlockTarget(editor, 2)!, "paragraph"),
  ).toBe(true);
  expect(editor.state.doc.nodeAt(2)!.type.name).toBe("paragraph");
  expect(editor.state.doc.nodeAt(2)!.firstChild!.marks).toEqual(marks);
});

test("directStyledListResetsBlockStyleAndCodePreservesIt", async () => {
  const { convertTextFamily } = await import(
    "../../src/editor/blocks/text-family"
  );
  for (const kind of ["bulletList", "codeBlock"] as const) {
    const editor = session([
      {
        type: "heading",
        attrs: { level: 1, style: "padding:12px 0 0" },
        content: [
          {
            type: "text",
            text: "Colored",
            marks: [
              { type: "preservedStyle", attrs: { style: "color:#123456" } },
            ],
          },
        ],
      },
    ]);
    expect(convertTextFamily(editor, kind, resolveBlockTarget(editor, 2))).toBe(
      true,
    );
    const node = editor.state.doc.nodeAt(2)!;
    if (kind === "codeBlock") {
      expect(node.attrs.style).toBe("padding:12px 0 0");
      expect(node.firstChild!.marks).toEqual([]);
    } else {
      expect(node.firstChild!.firstChild!.attrs.style).toBeFalsy();
      expect(
        node.firstChild!.firstChild!.firstChild!.marks[0].attrs.style,
      ).toBe("color:#123456");
    }
  }
});

for (const source of ["button", "codeBlock"]) {
  test(`${source}ToListRebuildsTextWithoutSourceAttrs`, async () => {
    const { convertTextFamily } = await import(
      "../../src/editor/blocks/text-family"
    );
    const editor = session([
      {
        type: source,
        attrs:
          source === "button"
            ? { href: "https://example.com", style: "width:240px" }
            : {
                language: "javascript",
                theme: "dracula",
                style: "padding:12px",
              },
        content: [{ type: "text", text: "Original" }],
      },
    ]);
    expect(
      convertTextFamily(editor, "bulletList", resolveBlockTarget(editor, 2)),
    ).toBe(true);
    const list = editor.state.doc.nodeAt(2)!;
    expect(list.type.name).toBe("bulletList");
    expect(list.firstChild!.firstChild!.type.name).toBe("paragraph");
    expect(list.textContent).toBe("Original");
    expect(list.firstChild!.firstChild!.attrs.style).toBeFalsy();
  });
}

test("buttonToCodeRetainsSharedAlignmentAndDropsHref", async () => {
  const { convertTextFamily } = await import(
    "../../src/editor/blocks/text-family"
  );
  const editor = session([
    {
      type: "button",
      attrs: { href: "https://example.com", alignment: "left" },
      content: [{ type: "text", text: "Button", marks: [{ type: "bold" }] }],
    },
  ]);
  expect(
    convertTextFamily(editor, "codeBlock", resolveBlockTarget(editor, 2)),
  ).toBe(true);
  const code = editor.state.doc.nodeAt(2)!;
  expect(code.attrs).toMatchObject({
    alignment: "left",
    language: "javascript",
    theme: "default",
  });
  expect(code.attrs.href).toBeUndefined();
  expect(code.firstChild!.marks).toEqual([]);
});
