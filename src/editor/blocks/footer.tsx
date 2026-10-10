import { EmailNode } from "@react-email/editor/core";
import { type JSONContent, mergeAttributes } from "@tiptap/core";
import { inlineCss } from "./content-style";
export const UNSUBSCRIBE_URL = "{{{UNSUBSCRIBE_URL}}}";
export function createFooterContent(): JSONContent[] {
  const text = (value: string): JSONContent => ({ type: "text", text: value });
  const br = (): JSONContent => ({ type: "hardBreak" });
  return [
    { type: "paragraph" },
    {
      type: "footer",
      content: [
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            text(
              "You are receiving this email because you opted in via our site.",
            ),
            br(),
            br(),
            text("Want to change how you receive these emails?"),
            br(),
            text("You can "),
            {
              ...text("unsubscribe from this list"),
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: UNSUBSCRIBE_URL,
                    target: "_blank",
                    rel: "noopener noreferrer nofollow",
                    "ses:no-track": "true",
                  },
                },
              ],
            },
            text("."),
          ],
        },
        {
          type: "paragraph",
          content: [
            text("Company Name"),
            br(),
            text("99 Street Address"),
            br(),
            text("City, STATE 000-000"),
          ],
        },
      ],
    },
  ];
}
export const Footer = EmailNode.create({
  name: "footer",
  content: "block*",
  group: "block",
  isolating: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({ class: { default: "node-footer" } }),
  parseHTML: () => [{ tag: "div[data-unsubscribe-footer]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(
      {
        "data-unsubscribe-footer": "",
        "data-type": "footer",
        class: "node-footer",
      },
      HTMLAttributes,
    ),
    0,
  ],
  renderToReactEmail: ({ node, children, style }) => (
    <table
      align="center"
      width="100%"
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      className={node.attrs?.class || undefined}
      style={{ ...style, ...inlineCss(node.attrs?.style) }}
    >
      <tbody>
        <tr>
          <td>{children}</td>
        </tr>
      </tbody>
    </table>
  ),
});
