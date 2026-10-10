import { EmailMark, EmailNode } from "@react-email/editor/core";
import { Bold, Paragraph, StarterKit } from "@react-email/editor/extensions";
import { Extension, type JSONContent, Mark, Node } from "@tiptap/core";
import { describe, expect, test } from "vitest";
import {
  createDocumentContract,
  validateDocument,
} from "../../src/editor/document-contract";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { createEditorExtensions } from "../helpers/extensions";

function neutral(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "globalContent",
        attrs: { data: { theme: "basic", css: "", styles: [] } },
      },
      {
        type: "container",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Welcome" }] },
        ],
      },
    ],
  };
}
const contract = createDocumentContract(createEditorExtensions());
function rejection(value: unknown, code: string, path: string) {
  expect(validateDocument(value, contract)).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([expect.objectContaining({ code, path })]),
  });
}

test("acceptsCanonicalNeutralDocument", () => {
  expect(validateDocument(neutral(), contract)).toMatchObject({ ok: true });
  expect(validateDocument(createReferenceDocument(), contract)).toMatchObject({
    ok: true,
  });
});

// Break caught: returning an empty or private fixture omits neutral, exportable starter blocks.
test("neutral fixture seeds neutral text, heading, section and example link", () => {
  const fixture = createReferenceDocument();
  expect(fixture).toMatchObject({
    type: "doc",
    content: [
      { type: "globalContent", attrs: { data: { theme: "basic", css: "" } } },
      {
        type: "container",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Welcome" }] },
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Template title" }],
          },
          {
            type: "section",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Section content" }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Read more",
                marks: [
                  { type: "link", attrs: { href: "https://example.com" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
});

describe("rejectsInvalidRootAndUnknownTypes", () => {
  test.each([
    null,
    [],
    {},
    { type: "paragraph" },
    { type: "doc" },
    { type: "doc", content: [] },
    { type: "doc", content: [{ type: "container" }] },
  ])("rejects malformed root %j", (value) =>
    rejection(value, "invalid-root", "$"),
  );
  test("rejects multiple containers before schema can accept them", () => {
    const doc = neutral();
    doc.content!.push({ type: "container", content: [{ type: "paragraph" }] });
    rejection(doc, "invalid-root", "$");
  });
  test("rejects outside visible blocks before container normalization", () => {
    const doc = neutral();
    doc.content!.push({ type: "paragraph" });
    rejection(doc, "invalid-root", "$");
  });
  test("rejects reordered metadata", () => {
    const doc = neutral();
    doc.content!.reverse();
    rejection(doc, "invalid-root", "$");
  });
  test.each(["container", "globalContent", "doc"])(
    "rejects nested %s",
    (type) => {
      const doc = neutral();
      doc.content![1].content!.push({ type });
      rejection(doc, "invalid-root", "$.content[1].content[1]");
    },
  );
  test("rejects unknown nodes even alongside invalid root", () => {
    const doc = neutral();
    doc.content!.push({ type: "unknownReplicaNode" });
    rejection(doc, "unsupported-node", "$.content[2].type");
  });
  test("rejects unknown marks on text", () => {
    const doc = neutral();
    doc.content![1].content![0].content![0].marks = [
      { type: "unknownReplicaMark" },
    ];
    rejection(
      doc,
      "unsupported-mark",
      "$.content[1].content[0].content[0].marks[0].type",
    );
  });
});

// Break caught: schema membership mistaken for email serializer support (silently dropped at export).
test("rejects schema nodes and marks without email serializers", () => {
  const node = Node.create({
    name: "schemaOnlyNode",
    group: "block",
    atom: true,
  });
  const mark = Mark.create({ name: "schemaOnlyMark" });
  const ownContract = createDocumentContract([
    ...createEditorExtensions(),
    node,
    mark,
  ]);
  const doc = neutral();
  doc.content![1].content!.push({ type: "schemaOnlyNode" });
  doc.content![1].content![0].content![0].marks = [{ type: "schemaOnlyMark" }];
  expect(validateDocument(doc, ownContract)).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([
      expect.objectContaining({
        code: "unsupported-node",
        path: "$.content[1].content[1].type",
      }),
      expect.objectContaining({
        code: "unsupported-mark",
        path: "$.content[1].content[0].content[0].marks[0].type",
      }),
    ]),
  });
});
test("extended email classes retain serialization eligibility; structural types are explicit", () => {
  const paragraph = Paragraph.extend({});
  const bold = Bold.extend({});
  expect(paragraph).toBeInstanceOf(EmailNode);
  expect(bold).toBeInstanceOf(EmailMark);
  const ownContract = createDocumentContract([
    StarterKit.configure({ Paragraph: false, Bold: false }),
    paragraph,
    bold,
  ]);
  const doc = neutral();
  doc.content![1].content![0].content![0].marks = [{ type: "bold" }];
  expect(validateDocument(doc, ownContract)).toMatchObject({ ok: true });
  for (const type of ["doc", "globalContent", "text", "paragraph", "container"])
    expect(ownContract.serializableNodes.has(type)).toBe(true);
});
test.each([Paragraph, Extension.create({ name: "styleAttribute" })])(
  "detects duplicate registration before last-wins resolution: $name",
  (extension) => {
    expect(() =>
      createDocumentContract([...createEditorExtensions(), extension]),
    ).toThrow(/duplicate.*extension/i);
  },
);

describe("checks schema and persisted data without discarding input", () => {
  test("rejects malformed children", () => {
    const doc = neutral();
    doc.content![1].content = [null as unknown as JSONContent];
    rejection(doc, "invalid-node", "$.content[1].content[0]");
  });
  test("rejects non-array content", () => {
    const doc = neutral();
    doc.content![1].content = {} as JSONContent[];
    rejection(doc, "invalid-node", "$.content[1].content");
  });
  test("rejects empty text before ProseMirror parsing", () => {
    const doc = neutral();
    doc.content![1].content![0].content![0].text = "";
    rejection(doc, "invalid-node", "$.content[1].content[0].content[0].text");
  });
  test("rejects invalid content nesting", () => {
    const doc = neutral();
    doc.content![1].content![0].content = [{ type: "paragraph" }];
    rejection(doc, "invalid-node", "$");
  });
  test("rejects invalid heading levels", () => {
    const doc = neutral();
    doc.content![1].content!.push({ type: "heading", attrs: { level: 7 } });
    rejection(doc, "invalid-node", "$.content[1].content[1].attrs.level");
  });
  test("rejects unknown attributes rather than silently dropping them", () => {
    const doc = neutral();
    doc.content![1].content![0].attrs = { unknownAttribute: "value" };
    rejection(
      doc,
      "invalid-node",
      "$.content[1].content[0].attrs.unknownAttribute",
    );
  });
  test("rejects object inline styles", () => {
    const doc = neutral();
    doc.content![1].content![0].attrs = { style: { padding: 0 } };
    rejection(doc, "invalid-style", "$.content[1].content[0].attrs.style");
  });
  test("rejects React elements and callbacks in persisted metadata", () => {
    const doc = neutral();
    doc.content![0].attrs!.data.styles = [
      {
        id: "body",
        title: "Body",
        inputs: [],
        headerSlot: {
          $$typeof: Symbol.for("react.transitional.element"),
          type: "span",
        },
      },
    ];
    rejection(
      doc,
      "invalid-style",
      "$.content[0].attrs.data.styles[0].headerSlot",
    );
  });
  test("rejects invalid theme names", () => {
    const doc = neutral();
    doc.content![0].attrs!.data.theme = "unverified";
    rejection(doc, "invalid-style", "$.content[0].attrs.data.theme");
  });
  test("retains explicit zero, inherited and automatic inline values without mutating caller", () => {
    const doc = neutral();
    doc.content![1].content![0].attrs = {
      style: "padding-top: 0px; width: auto;",
    };
    const before = structuredClone(doc);
    const result = validateDocument(doc, contract);
    expect(result).toMatchObject({ ok: true, document: before });
    expect(doc).toEqual(before);
  });
});

// Break caught: malformed persisted fields or cyclic objects bypass preflight or crash validation.
test.each([
  ["content", false],
  ["marks", {}],
  ["attrs", []],
  ["extra", "lost"],
])("rejects malformed node field %s", (key, value) => {
  const doc = neutral();
  Object.assign(doc.content![1].content![0], { [key]: value });
  rejection(doc, "invalid-node", `$.content[1].content[0].${key}`);
});
test.each([
  ["styles", null],
  ["css", 42],
  [
    "styles",
    [
      {
        id: "body",
        title: "Body",
        inputs: [
          {
            label: "Width",
            type: "number",
            value: 14,
            prop: "unknownProperty",
            classReference: "body",
          },
        ],
      },
    ],
  ],
])("rejects malformed global %s", (key, value) => {
  const doc = neutral();
  doc.content![0].attrs!.data[key] = value;
  const result = validateDocument(doc, contract);
  expect(result).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "invalid-style" }),
    ]),
  });
});
test("rejects missing global data", () => {
  const doc = neutral();
  doc.content![0].attrs = {};
  rejection(doc, "invalid-style", "$.content[0].attrs.data");
});
test("rejects nonserializable metadata functions", () => {
  const doc = neutral();
  doc.content![0].attrs!.data.callback = () => "lost";
  rejection(doc, "invalid-style", "$.content[0].attrs.data.callback");
});
test("rejects cyclic document without recursion overflow", () => {
  const doc = neutral();
  doc.content![1].content!.push(doc);
  rejection(doc, "invalid-node", "$.content[1].content[1]");
});
test("rejects malformed marks at their own path", () => {
  const doc = neutral();
  doc.content![1].content![0].content![0].marks = [
    null as unknown as { type: string },
  ];
  rejection(doc, "invalid-node", "$.content[1].content[0].content[0].marks[0]");
});

test("rejects children attached to text before nodeFromJSON can discard them", () => {
  const doc = neutral();
  doc.content![1].content![0].content![0].content = [
    { type: "text", text: "Dropped child" },
  ];
  rejection(doc, "invalid-node", "$.content[1].content[0].content[0].content");
});
test("rejects envelope marks that the email serializer cannot apply", () => {
  const doc = neutral();
  doc.marks = [{ type: "bold" }];
  rejection(doc, "invalid-node", "$.marks");
});

// Break caught: malformed theme discriminators are approved as persisted canonical data.
test.each([
  { malformedType: ["number"] },
  { malformedType: ["color"] },
  { malformedType: { value: "number" } },
])(
  "rejects persisted non-string theme discriminator %j",
  ({ malformedType }) => {
    const doc = neutral();
    doc.content![0].attrs!.data.styles = [
      {
        id: "body",
        title: "Body",
        classReference: "body",
        inputs: [
          {
            label: "Background",
            type: malformedType,
            value: "#ffffff",
            prop: "backgroundColor",
            classReference: "body",
          },
        ],
      },
    ];
    rejection(
      doc,
      "invalid-style",
      "$.content[0].attrs.data.styles[0].inputs[0].type",
    );
  },
);
