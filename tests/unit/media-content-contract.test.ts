import { composeReactEmail } from "@react-email/editor/core";
import { Editor, type JSONContent } from "@tiptap/core";
import { expect, test } from "vitest";
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
// Missing families must be registered as email-aware nodes, not silently omitted.
test.each(["htmlContent", "footer", "socialLinks", "youtube", "twitter"])(
  "%s registers a renderer and captured schema",
  (type) => {
    const contract = createDocumentContract(createEditorExtensions());
    expect(contract.serializableNodes.has(type)).toBe(true);
    expect(contract.schema.nodes[type]).toBeDefined();
  },
);
test("raw HTML and footer unsubscribe preserve actual email content", async () => {
  const content: JSONContent[] = [
    {
      type: "htmlContent",
      attrs: {
        content: "<table><tbody><tr><td>Neutral HTML</td></tr></tbody></table>",
      },
    },
    {
      type: "footer",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "unsubscribe",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "{{{UNSUBSCRIBE_URL}}}",
                    "ses:no-track": "true",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  const contract = createDocumentContract(createEditorExtensions());
  expect(validateDocument(wrap(content), contract).ok).toBe(true);
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: wrap(content),
  });
  const output = await composeReactEmail({ editor });
  expect(output.html).toContain("<td>Neutral HTML</td>");
  expect(output.html).toContain('href="{{{UNSUBSCRIBE_URL}}}"');
  expect(output.html).toContain('ses:no-track="true"');
  expect(output.text).toContain("Neutral HTML");
  editor.destroy();
});
test("social export keeps platform order and 32px static linked icons", async () => {
  const doc = wrap([
    {
      type: "socialLinks",
      attrs: {
        links: {
          github: "https://github.com/example",
          linkedin: "https://www.linkedin.com/company/example",
        },
      },
    },
  ]);
  expect(
    validateDocument(doc, createDocumentContract(createEditorExtensions())).ok,
  ).toBe(true);
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: doc,
  });
  const { html } = await composeReactEmail({ editor });
  expect(html.indexOf('alt="LinkedIn"')).toBeLessThan(
    html.indexOf('alt="GitHub"'),
  );
  expect(html).toContain('src="/icons/tabler/brand-github.svg"');
  expect(html).toContain('data-id="__react-email-column"');
  expect(html).toContain('style="width:100%"');
  expect(html).toContain('width="32"');
  expect(html).toContain("padding-right:8px");
  editor.destroy();
});
test("media linked static images retain node style and do not export embeds", async () => {
  const doc = wrap([
    {
      type: "youtube",
      attrs: {
        internal_linkHref: "https://www.youtube.com/watch?v=neutral&t=15",
        internal_imageSource: "https://example.com/video.png",
        style: "border-radius:8px",
      },
    },
    {
      type: "twitter",
      attrs: {
        internal_linkHref: "https://x.com/example/status/123",
        internal_imageSource: "https://example.com/post.png",
      },
    },
  ]);
  expect(
    validateDocument(doc, createDocumentContract(createEditorExtensions())).ok,
  ).toBe(true);
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: doc,
  });
  const { html } = await composeReactEmail({ editor });
  expect(html).toContain(
    'href="https://www.youtube.com/watch?v=neutral&amp;t=15"',
  );
  expect(html).toContain('alt="YouTube video"');
  expect(html).toContain("border-radius:8px");
  expect(html).toContain("max-width:550px");
  expect(html).not.toContain("<iframe");
  editor.destroy();
});
test("transient blob image cannot be saved or exported as a durable email", () => {
  expect(
    validateDocument(
      wrap([{ type: "image", attrs: { src: "blob:neutral" } }]),
      createDocumentContract(createEditorExtensions()),
    ).ok,
  ).toBe(false);
});
test("linked image retains mixed dimensions and per-node style in email", async () => {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: wrap([
      {
        type: "image",
        attrs: {
          src: "https://example.com/image.png",
          alt: "Neutral image",
          href: "https://example.com/neutral",
          width: "50%",
          height: "80",
          style: "border-radius:8px;max-width:100%",
        },
      },
    ]),
  });
  const { html } = await composeReactEmail({ editor });
  expect(html).toContain('href="https://example.com/neutral"');
  expect(html).toContain('width="50%"');
  expect(html).toContain('height="80"');
  expect(html).toContain('data-id="__react-email-column"');
  expect(html).toContain("border-radius:8px");
  editor.destroy();
});
test.each([
  { type: "htmlContent", attrs: { content: 42 } },
  { type: "socialLinks", attrs: { links: { github: "javascript:alert(1)" } } },
  { type: "youtube", attrs: { internal_includePlayButton: "yes" } },
  { type: "twitter", attrs: { internal_darkMode: "yes" } },
])("raw malformed media attributes stay quarantined ($type)", (node) => {
  expect(
    validateDocument(
      wrap([node]),
      createDocumentContract(createEditorExtensions()),
    ).ok,
  ).toBe(false);
});

test("Image email pixel dimensions round and reject subpixel/invalid dimensions", async () => {
  const render = async (width: unknown, height: unknown) => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: wrap([
        {
          type: "image",
          attrs: { src: "https://example.com/image.png", width, height },
        },
      ]),
    });
    const { html } = await composeReactEmail({ editor });
    editor.destroy();
    return html;
  };
  expect(await render(" 12.6 ", 12.6)).toMatch(/width="13"/);
  expect(await render(" 12.6 ", 12.6)).toMatch(/height="13"/);
  expect(await render("50%", 0.4)).toMatch(/width="50%"/);
  expect(await render("50%", 0.4)).not.toMatch(/height="0.4"/);
  expect(await render("12px", "auto")).not.toMatch(
    /width="12px"|height="auto"/,
  );
});
