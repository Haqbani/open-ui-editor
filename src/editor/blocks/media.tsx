import { EmailNode } from "@react-email/editor/core";
import { mergeAttributes } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { CSSProperties } from "react";
import {
  extractTweetId,
  extractYouTubeId,
  localMediaServices,
  normalizeYouTubeUrl,
} from "../services/media";
import { getEditorStorage } from "../storage/editor-storage";
import { getEditorSessionRevision } from "./commands";
import { inlineCss } from "./content-style";

function StaticMedia({
  kind,
  href,
  source,
  style,
  className,
  editing = false,
  alignment = "left",
}: {
  kind: "youtube" | "twitter";
  href: string;
  source: string;
  style: CSSProperties;
  className?: string;
  editing?: boolean;
  alignment?: string;
}) {
  const content = (
    <>
      {/* biome-ignore lint/performance/noImgElement: standard img preserves editor and email image URLs and dimensions. */}
      <img
        className={kind === "youtube" ? "node-image" : undefined}
        alt={kind === "youtube" ? "YouTube video" : "X's post"}
        width="100%"
        {...(kind === "twitter" ? { alignment } : {})}
        src={source || `/media/${kind}-placeholder.svg`}
        style={{
          display: "block",
          outline: "none",
          border: "none",
          textDecoration: "none",
          ...style,
        }}
      />
      <div data-node-view-content="" style={{ whiteSpace: "pre-wrap" }} />
    </>
  );
  return href && !editing ? (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className={`${className ?? kind} ${kind}Content`}
    >
      {content}
    </a>
  ) : (
    <div className={`${kind}Content`}>{content}</div>
  );
}
function mediaExtension(kind: "youtube" | "twitter") {
  return EmailNode.create({
    name: kind,
    group: "block",
    marks: "",
    atom: true,
    draggable: false,
    addAttributes: () => ({
      class: { default: kind },
      alignment: { default: "left" },
      internal_linkHref: { default: "" },
      internal_imageSource: { default: "" },
      internal_pasteId: {
        default: null,
        renderHTML: () => ({}),
        parseHTML: () => null,
      },
      ...(kind === "youtube"
        ? { internal_includePlayButton: { default: true } }
        : {
            internal_darkMode: { default: false },
            internal_isLoading: {
              default: false,
              renderHTML: () => ({}),
              parseHTML: () => null,
            },
          }),
    }),
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey(`${kind}Paste`),
          props: {
            handlePaste(view, event) {
              const raw = event.clipboardData?.getData("text/plain")?.trim();
              if (
                !raw ||
                !(kind === "youtube"
                  ? extractYouTubeId(raw)
                  : extractTweetId(raw))
              )
                return false;
              event.preventDefault();
              const href =
                  kind === "youtube" ? (normalizeYouTubeUrl(raw) ?? raw) : raw,
                pasteId = crypto.randomUUID();
              let darkMode = false;
              try {
                darkMode =
                  getEditorStorage(editor).getItem(
                    "open-ui-editor-twitter-dark-mode",
                  ) === "true";
              } catch {}
              const attrs = {
                internal_linkHref: href,
                internal_pasteId: pasteId,
                ...(kind === "twitter"
                  ? { internal_darkMode: darkMode, internal_isLoading: true }
                  : { internal_includePlayButton: true }),
              };
              const tr = view.state.tr.replaceSelectionWith(
                view.state.schema.nodes[kind].create(attrs),
              );
              let position: number | undefined;
              tr.doc.descendants((node, pos) => {
                if (node.attrs.internal_pasteId === pasteId) position = pos;
              });
              if (position !== undefined)
                tr.setSelection(NodeSelection.create(tr.doc, position));
              view.dispatch(tr);
              const revision = getEditorSessionRevision(editor),
                abort = new AbortController();
              void localMediaServices
                .preview(
                  kind,
                  href,
                  { darkMode, includePlayButton: true },
                  { draftId: "foundation", revision, requestId: pasteId },
                  abort.signal,
                )
                .then((result) => {
                  if (
                    editor.isDestroyed ||
                    getEditorSessionRevision(editor) !== revision ||
                    position === undefined
                  )
                    return;
                  const node = editor.state.doc.nodeAt(position);
                  if (node?.attrs.internal_pasteId !== pasteId) return;
                  const next = {
                    ...node.attrs,
                    internal_pasteId: null,
                    ...(kind === "twitter"
                      ? { internal_isLoading: false }
                      : {}),
                    ...(result.ok
                      ? { internal_imageSource: result.value.url }
                      : {}),
                  };
                  editor.view.dispatch(
                    editor.state.tr.setNodeMarkup(position, null, next),
                  );
                  if (!result.ok)
                    editor.view.dom.dispatchEvent(
                      new CustomEvent("media-error", {
                        detail: result.message,
                        bubbles: true,
                      }),
                    );
                });
              return true;
            },
          },
        }),
      ];
    },
    parseHTML: () => [{ tag: `a[data-id="react-email-${kind}"]` }],
    renderHTML: ({ HTMLAttributes }) => [
      "a",
      mergeAttributes({ "data-id": `react-email-${kind}` }, HTMLAttributes),
      0,
    ],
    addNodeView: () =>
      ReactNodeViewRenderer(({ node }) => (
        <NodeViewWrapper className={`node-image align-${node.attrs.alignment}`}>
          <StaticMedia
            alignment={node.attrs.alignment}
            kind={kind}
            href={node.attrs.internal_linkHref}
            source={node.attrs.internal_imageSource}
            editing
            style={{
              ...inlineCss(node.attrs.style),
              ...(kind === "twitter"
                ? { width: "100%", maxWidth: "550px" }
                : {}),
            }}
          />
        </NodeViewWrapper>
      )),
    renderToReactEmail: ({ node, style }) => (
      <StaticMedia
        alignment={node.attrs?.alignment}
        kind={kind}
        href={node.attrs?.internal_linkHref}
        source={node.attrs?.internal_imageSource}
        className={node.attrs?.class}
        style={{
          ...style,
          ...inlineCss(node.attrs?.style),
          ...(kind === "twitter" ? { width: "100%", maxWidth: "550px" } : {}),
        }}
      />
    ),
  });
}
export const YouTube = mediaExtension("youtube");
export const Twitter = mediaExtension("twitter");
