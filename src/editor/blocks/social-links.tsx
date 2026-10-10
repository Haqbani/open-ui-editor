import { EmailNode } from "@react-email/editor/core";
import { type Editor, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { isSafeUrl } from "../services/safe-url";
import { getEditorStorage } from "../storage/editor-storage";
import { SOCIAL_LINKS } from "./social-platforms";
export function sanitizeSocialLinks(
  value: unknown,
): Record<string, string | false> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => v === false || (typeof v === "string" && !!v && isSafeUrl(v)),
    ),
  );
}
export function cachedSocialLinks(editor?: Editor) {
  try {
    return sanitizeSocialLinks(
      JSON.parse(
        getEditorStorage(editor).getItem("open-ui-editor-social-links") ?? "{}",
      ),
    );
  } catch {
    return {};
  }
}
function SocialIcons({ links }: { links: Record<string, string | false> }) {
  const enabled = SOCIAL_LINKS.filter((p) => links[p.value]);
  return (
    <table
      align="center"
      width="100%"
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
    >
      <tbody>
        <tr>
          <td>
            <table
              align="center"
              width="100%"
              border={0}
              cellPadding="0"
              cellSpacing="0"
              role="presentation"
            >
              <tbody style={{ width: "100%" }}>
                <tr style={{ width: "100%" }}>
                  <td data-id="__react-email-column" />
                  {enabled.length
                    ? enabled.map((p) => (
                        <td
                          key={p.value}
                          data-id="__react-email-column"
                          align="center"
                          style={{
                            paddingRight: "8px",
                            width: "32px",
                            boxSizing: "content-box",
                          }}
                        >
                          <a
                            href={String(links[p.value])}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {/* biome-ignore lint/performance/noImgElement: standard img preserves the captured editor/email asset URL and dimensions. */}
                            <img
                              alt={p.label}
                              width={32}
                              height={32}
                              src={p.icon}
                              style={{
                                display: "block",
                                outline: "none",
                                border: "none",
                                textDecoration: "none",
                              }}
                            />
                          </a>
                        </td>
                      ))
                    : [0, 1, 2].map((i) => (
                        <td
                          key={i}
                          data-id="__react-email-column"
                          align="center"
                          style={{
                            paddingRight: "8px",
                            width: "32px",
                            boxSizing: "content-box",
                          }}
                        >
                          <div
                            style={{
                              background: "rgba(0,0,0,.1)",
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                            }}
                          />
                        </td>
                      ))}
                  <td data-id="__react-email-column" />
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
export const SocialLinks = EmailNode.create({
  name: "socialLinks",
  group: "block",
  marks: "",
  atom: true,
  addAttributes: () => ({
    class: { default: "socialLinks" },
    content: { default: "" },
    links: {
      default: {},
      parseHTML: (el) => {
        try {
          return sanitizeSocialLinks(
            JSON.parse(el.getAttribute("data-links") ?? "{}"),
          );
        } catch {
          return {};
        }
      },
      renderHTML: (attrs) => ({
        "data-links": JSON.stringify(sanitizeSocialLinks(attrs.links)),
      }),
    },
  }),
  parseHTML: () => [{ tag: "[data-social-links]" }],
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-social-links": true, "data-type": "socialLinks" },
        HTMLAttributes,
      ),
    ];
  },
  addNodeView: () =>
    ReactNodeViewRenderer(({ node, selected }) => (
      <NodeViewWrapper data-type="socialLinks">
        <div className={selected ? "socialLinksNode-selected" : undefined}>
          <SocialIcons links={node.attrs.links} />
        </div>
      </NodeViewWrapper>
    )),
  renderToReactEmail: ({ node }) => (
    <SocialIcons links={node.attrs?.links ?? {}} />
  ),
});
