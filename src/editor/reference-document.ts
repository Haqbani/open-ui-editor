import { EDITOR_THEMES } from "@react-email/editor/plugins";
import type { JSONContent } from "@tiptap/core";

/** Neutral local test data, independent of the user's private template. */
export function createReferenceDocument(): JSONContent {
  // Trusted package constants: drop undefined optional fields, preserve numeric values.
  const styles: unknown = JSON.parse(JSON.stringify(EDITOR_THEMES.basic));
  return {
    type: "doc",
    content: [
      {
        type: "globalContent",
        attrs: { data: { theme: "basic", css: "", styles } },
      },
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
  };
}
