import { EmailNode } from "@react-email/editor/core";
import { LinkIcon } from "@react-email/editor/ui";
import type { Editor, NodeViewProps } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { closeEditorHistory } from "../history/history-boundary";
import { getEditorSessionRevision } from "./commands";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ogLinkPreview: { insertOgLinkPreview: () => ReturnType };
  }
}
export function isOgPreviewUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      !/^(?:.*\.)?(?:youtube\.com|youtu\.be|twitter\.com|x\.com)$/.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
export type OgPreviewRequest = {
  url: string;
  pasteId: string;
  position: number;
  revision: number;
};
/** Task6 installs real metadata/image transport. Requests never fabricate successful cards. */
export function requestOgPreview(
  editor: Editor,
  url: string,
  position: number,
  pasteId = crypto.randomUUID(),
) {
  const node = editor.state.doc.nodeAt(position);
  if (node?.type.name !== "ogLinkPreview" || !isOgPreviewUrl(url)) return false;
  const detail: OgPreviewRequest = {
    url,
    pasteId,
    position,
    revision: getEditorSessionRevision(editor),
  };
  editor.view.dom.dispatchEvent(
    new CustomEvent<OgPreviewRequest>("og-link-preview:link-pasted", {
      detail,
      bubbles: true,
    }),
  );
  return true;
}
function Preview({ editor, node, getPos }: NodeViewProps) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!node.attrs.internal_linkHref) {
      const frame = requestAnimationFrame(() => input.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [node.attrs.internal_linkHref]);
  const submit = (url: string) => {
    const pos = getPos();
    if (typeof pos === "number") requestOgPreview(editor, url, pos);
  };
  return (
    <NodeViewWrapper>
      <div className="og-preview-placeholder">
        <LinkIcon size={16} />
        {node.attrs.internal_linkHref ? (
          <span>{node.attrs.internal_linkHref}</span>
        ) : (
          <input
            ref={input}
            type="url"
            aria-label="Link preview URL"
            placeholder="Paste a URL and press Enter…"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit(value);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                const pos = getPos();
                if (typeof pos === "number") {
                  editor.view.dispatch(closeEditorHistory(editor.state.tr));
                  editor
                    .chain()
                    .deleteRange({ from: pos, to: pos + node.nodeSize })
                    .run();
                }
              }
            }}
            onPaste={(event) => {
              const url = event.clipboardData.getData("text");
              if (isOgPreviewUrl(url)) {
                event.preventDefault();
                setValue(url);
                submit(url);
              }
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
export const OgLinkPreview = EmailNode.create({
  name: "ogLinkPreview",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes: () => ({
    internal_pasteId: {
      default: null,
      renderHTML: () => ({}),
      parseHTML: () => null,
    },
    internal_linkHref: { default: "" },
    internal_isLoading: {
      default: false,
      renderHTML: () => ({}),
      parseHTML: () => null,
    },
  }),
  parseHTML: () => [{ tag: 'div[data-id="og-link-preview-placeholder"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    { "data-id": "og-link-preview-placeholder", ...HTMLAttributes },
  ],
  renderToReactEmail({ node }) {
    const href = node.attrs?.internal_linkHref || "";
    return href ? <a href={href}>{href}</a> : null;
  },
  addCommands() {
    return {
      insertOgLinkPreview:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("ogLinkPreviewPaste"),
        props: {
          handlePaste(view, event) {
            const url = event.clipboardData?.getData("text/plain")?.trim();
            if (!url || !isOgPreviewUrl(url)) return false;
            event.preventDefault();
            const pasteId = crypto.randomUUID();
            const { from, to } = view.state.selection;
            view.dispatch(
              view.state.tr.replaceRangeWith(
                from,
                to,
                view.state.schema.nodes.ogLinkPreview.create({
                  internal_linkHref: url,
                  internal_pasteId: pasteId,
                }),
              ),
            );
            let pos: number | undefined;
            view.state.doc.descendants((node, p) => {
              if (node.attrs.internal_pasteId === pasteId) pos = p;
            });
            if (pos !== undefined) requestOgPreview(editor, url, pos, pasteId);
            return true;
          },
        },
      }),
    ];
  },
  addNodeView: () => ReactNodeViewRenderer(Preview),
});
