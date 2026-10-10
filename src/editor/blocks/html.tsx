import { EmailNode } from "@react-email/editor/core";
import { mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import DOMPurify from "dompurify";
export function normalizeCustomHtml(content: string) {
  return DOMPurify.sanitize(
    new DOMParser().parseFromString(`<body>${content}</body>`, "text/html").body
      .innerHTML,
  );
}
export const Html = EmailNode.create({
  name: "htmlContent",
  group: "block",
  marks: "",
  atom: true,
  defining: true,
  draggable: true,
  addAttributes: () => ({ content: { default: "" } }),
  parseHTML: () => [{ tag: "[data-html-content]" }],
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-html-content": true }, HTMLAttributes),
    ];
  },
  addNodeView: () =>
    ReactNodeViewRenderer(({ node, selected }) => (
      <NodeViewWrapper>
        <div
          className={`htmlContent pointer-events-none${selected ? " htmlContent-selected" : ""}`}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: source HTML atom is normalized through DOMPurify.
          dangerouslySetInnerHTML={{
            __html: normalizeCustomHtml(node.attrs.content),
          }}
        />
      </NodeViewWrapper>
    )),
  addProseMirrorPlugins() {
    const normalize = (state: import("@tiptap/pm/state").EditorState) => {
      if (typeof window === "undefined") return null;
      const tr = state.tr;
      state.doc.descendants((node, pos) => {
        if (node.type.name !== "htmlContent" || !node.attrs.content) return;
        const content = normalizeCustomHtml(node.attrs.content);
        if (content !== node.attrs.content)
          tr.setNodeMarkup(pos, null, { ...node.attrs, content });
      });
      return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
    };
    return [
      new Plugin({
        key: new PluginKey("htmlContentNormalization"),
        view: (view) => {
          queueMicrotask(() => {
            if (!view.isDestroyed) {
              const tr = normalize(view.state);
              if (tr) view.dispatch(tr);
            }
          });
          return {};
        },
        appendTransaction: (transactions, _oldState, newState) =>
          transactions.some((tr) => tr.docChanged) ? normalize(newState) : null,
      }),
    ];
  },
  renderToReactEmail: ({ node }) => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: email serialization must preserve the normalized custom HTML.
    <div dangerouslySetInnerHTML={{ __html: node.attrs?.content ?? "" }} />
  ),
});
