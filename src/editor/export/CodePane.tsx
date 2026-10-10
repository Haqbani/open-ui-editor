"use client";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef, useState } from "react";

export function CodePane({ html }: { html: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const mounted = new EditorView({
      parent: host.current,
      state: EditorState.create({
        extensions: [
          basicSetup,
          htmlLanguage(),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({
            "aria-label": "Generated HTML",
            tabindex: "0",
          }),
          EditorView.theme({
            "&": { height: "100%", backgroundColor: "transparent" },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "ui-monospace, monospace",
              fontSize: "12px",
            },
            ".cm-gutters": { backgroundColor: "transparent", border: "none" },
          }),
        ],
      }),
    });
    view.current = mounted;
    return () => {
      view.current = null;
      mounted.destroy();
    };
  }, []);
  useEffect(() => {
    const mounted = view.current;
    if (mounted)
      mounted.dispatch({
        changes: { from: 0, to: mounted.state.doc.length, insert: html },
      });
    setCopyError(false);
  }, [html]);
  return (
    <section className="code-pane" aria-label="HTML code editor">
      <header className="code-pane-header">
        <span>HTML code editor</span>
        <button type="button" disabled aria-label="Edit HTML">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>{" "}
          Edit HTML
        </button>
        <button
          type="button"
          aria-label="Copy HTML"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(html);
              setCopyError(false);
            } catch {
              setCopyError(true);
            }
          }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="5" y="8" width="12" height="12" rx="2" />
            <path d="M9 8V4h11v12h-3" />
          </svg>
        </button>
      </header>
      {copyError && <p role="alert">Could not copy HTML.</p>}
      <div className="code-pane-source" ref={host} />
    </section>
  );
}
