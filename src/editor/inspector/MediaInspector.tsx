import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import { normalizeButtonLink } from "../blocks/basic-family";
import { type BlockTarget, getEditorSessionRevision } from "../blocks/commands";
import { AlignmentField } from "../controls/AlignmentField";
import {
  extractTweetId,
  extractYouTubeId,
  isTwitterUrl,
  localMediaServices,
  normalizeYouTubeUrl,
} from "../services/media";
import { getEditorStorage } from "../storage/editor-storage";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { SizeControls } from "./SizeControls";
import { ThemeOptions } from "./ThemeOptions";
import { useFamilyTarget } from "./use-family-target";
export function MediaInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const kind = target.nodeType,
    attrs = editor.state.doc.nodeAt(target.pos)?.attrs ?? {},
    youtube = kind === "youtube";
  const [url, setUrl] = useState(
      String(attrs.internal_linkHref ?? attrs.src ?? ""),
    ),
    [option, setOption] = useState(
      Boolean(
        youtube ? attrs.internal_includePlayButton : attrs.internal_darkMode,
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const focusContainer = useRef<HTMLDivElement>(null);
  const cache = useRef<Record<string, string>>({}),
    request = useRef<AbortController | null>(null);
  const [imageDraft, setImageDraft] = useState({
    src: String(attrs.src ?? ""),
    alt: String(attrs.alt ?? ""),
    href: String(attrs.href ?? ""),
  });
  const { get, accept } = useFamilyTarget(editor, target, (node, replaced) => {
    if (replaced) {
      request.current?.abort();
      setBusy(false);
      setError("");
      cache.current = {};
    }
    const a = node?.attrs ?? {};
    setUrl(String(a.internal_linkHref ?? a.src ?? ""));
    setOption(
      Boolean(youtube ? a.internal_includePlayButton : a.internal_darkMode),
    );
    setImageDraft({
      src: String(a.src ?? ""),
      alt: String(a.alt ?? ""),
      href: String(a.href ?? ""),
    });
  });
  const patch = (change: Record<string, unknown>) => {
    const node = get();
    if (node) {
      const tr = editor.state.tr.setNodeMarkup(target.pos, null, {
        ...node.attrs,
        ...change,
      });
      if (
        editor.state.selection instanceof NodeSelection &&
        editor.state.selection.from === target.pos
      )
        tr.setSelection(NodeSelection.create(tr.doc, target.pos));
      editor.view.dispatch(tr);
      accept();
    }
  };
  useEffect(() => () => request.current?.abort(), []);
  if (kind === "image")
    return (
      <div className="inspector-content" ref={focusContainer} tabIndex={-1}>
        <InspectorHeading>
          <InspectorNodeTitle type={target.nodeType}>Image</InspectorNodeTitle>
          <ThemeOptions editor={editor} pos={target.pos} />
        </InspectorHeading>
        <h3>Content</h3>
        <label className="control-row">
          Source
          <input
            className="field-surface"
            aria-label="Source"
            value={imageDraft.src}
            onChange={(e) =>
              setImageDraft({ ...imageDraft, src: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const source = e.currentTarget.value.trim();
                if (/^https?:\/\//.test(source)) patch({ src: source });
              }
            }}
          />
        </label>
        <label className="control-row">
          Alt
          <textarea
            className="field-surface"
            aria-label="Alt"
            value={imageDraft.alt}
            onChange={(e) =>
              setImageDraft({ ...imageDraft, alt: e.target.value })
            }
            onBlur={(e) => patch({ alt: e.target.value })}
          />
        </label>
        <label className="control-row">
          Link
          <input
            className="field-surface"
            aria-label="Link"
            value={imageDraft.href}
            onChange={(e) =>
              setImageDraft({ ...imageDraft, href: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = normalizeButtonLink(e.currentTarget.value);
                if (value !== null) patch({ href: value });
              }
            }}
          />
        </label>
        <SizeControls
          editor={editor}
          pos={target.pos}
          onAttributesChange={patch}
        />
        <AlignmentField
          value={attrs.alignment ?? "left"}
          onChange={(alignment) => patch({ alignment })}
        />
        <LayoutControls editor={editor} pos={target.pos} groups={{}} />
      </div>
    );
  const id = youtube ? extractYouTubeId(url) : extractTweetId(url);
  const generate = async (value: string, nextOption: boolean) => {
    const node = get();
    if (!node) return;
    const mediaId = youtube ? extractYouTubeId(value) : extractTweetId(value);
    if (!mediaId) return;
    const key = `${mediaId}:${nextOption}`;
    if (!Object.keys(cache.current).length && attrs.internal_imageSource) {
      const prior = youtube
        ? extractYouTubeId(attrs.internal_linkHref)
        : extractTweetId(attrs.internal_linkHref);
      if (prior)
        cache.current[
          `${prior}:${Boolean(youtube ? attrs.internal_includePlayButton : attrs.internal_darkMode)}`
        ] = attrs.internal_imageSource;
    }
    if (cache.current[key]) {
      patch({ internal_imageSource: cache.current[key] });
      return;
    }
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    focusContainer.current?.focus({ preventScroll: true });
    setBusy(true);
    setError("");
    const context = {
      draftId: "foundation",
      revision: getEditorSessionRevision(editor),
      requestId: crypto.randomUUID(),
      target,
    };
    const owner = get();
    const result = await localMediaServices.preview(
      youtube ? "youtube" : "twitter",
      value,
      { includePlayButton: nextOption, darkMode: nextOption },
      context,
      abort.signal,
    );
    if (abort.signal.aborted || editor.isDestroyed) return;
    setBusy(false);
    if (
      get() !== owner ||
      getEditorSessionRevision(editor) !== context.revision
    ) {
      setError(
        "Preview finished after the document changed. Apply the URL again.",
      );
      return;
    }
    if (result.ok) {
      cache.current[key] = result.value.url;
      patch({
        internal_imageSource: result.value.url,
        internal_isLoading: false,
      });
    } else setError(result.message);
  };
  const apply = (value = url) => {
    const trimmed = value.trim();
    if (!youtube && !trimmed) {
      setUrl("");
      patch({
        internal_linkHref: "",
        internal_imageSource: "",
        internal_darkMode: option,
      });
      return;
    }
    const normalized = youtube ? normalizeYouTubeUrl(value) : trimmed;
    if (
      !normalized ||
      !(youtube ? extractYouTubeId(normalized) : extractTweetId(normalized))
    )
      return;
    setUrl(normalized);
    if (
      !error &&
      attrs.internal_imageSource &&
      attrs.internal_linkHref === normalized &&
      Boolean(
        youtube ? attrs.internal_includePlayButton : attrs.internal_darkMode,
      ) === option
    )
      return;
    patch({
      internal_linkHref: normalized,
      [youtube ? "internal_includePlayButton" : "internal_darkMode"]: option,
    });
    void generate(normalized, option);
  };
  return (
    <div className="inspector-content" ref={focusContainer} tabIndex={-1}>
      <InspectorHeading>
        <InspectorNodeTitle type={target.nodeType}>
          {youtube ? "YouTube video" : "X (Twitter) post"}
        </InspectorNodeTitle>
      </InspectorHeading>
      <h3>Content</h3>
      <label className="control-row">
        URL
        <input
          className="field-surface"
          aria-label="URL"
          type="url"
          placeholder={
            youtube ? "https://youtube.com/watch?v=..." : "https://x.com/..."
          }
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const value = e.clipboardData.getData("text");
            setUrl(value);
            apply(value);
          }}
        />
      </label>
      {busy && (
        <span role="status" aria-label="Uploading preview">
          Uploading preview
        </span>
      )}
      {!id && url.length > 0 && (
        <p role="alert">
          {youtube
            ? "Invalid YouTube URL"
            : isTwitterUrl(url)
              ? "URL must link to a post (e.g. https://x.com/username/status/123)."
              : "Invalid URL"}
        </p>
      )}
      <label className="control-row">
        <input
          type="checkbox"
          checked={option}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            setOption(next);
            if (!youtube)
              try {
                getEditorStorage(editor).setItem(
                  "open-ui-editor-twitter-dark-mode",
                  String(next),
                );
              } catch {}
            if (id) {
              patch({
                [youtube ? "internal_includePlayButton" : "internal_darkMode"]:
                  next,
              });
              void generate(url, next);
            }
          }}
        />
        {youtube ? "Include play button" : "Dark mode"}
      </label>
      {error && <p role="alert">{error}</p>}
      <AlignmentField
        value={attrs.alignment ?? "left"}
        onChange={(alignment) => patch({ alignment })}
      />
      <SizeControls
        editor={editor}
        pos={target.pos}
        onAttributesChange={patch}
      />
      <LayoutControls editor={editor} pos={target.pos} groups={{}} />
    </div>
  );
}
