import { css } from "@codemirror/lang-css";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { getGlobalContent } from "@react-email/editor/extensions";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef } from "react";
import { cssEditorSetup } from "./css-editor-setup";
import { cssEditorTheme } from "./css-editor-theme";

const controlledValue = Annotation.define<boolean>();

const help =
  "/*\n\nYou can style your email using global selectors:\n\np { color: red; } \n\nOr you can also add a custom class for a specific element:\n\n.example { color: blue; } \n\n*/";
const presets = [
  "@media (prefers-color-scheme: dark)",
  "@media screen and (max-width: 480px)",
  ".button",
];
export function GlobalCssPanel({ editor }: { editor: Editor }) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null);
  const currentCss = String(getGlobalContent("css", editor) ?? "");
  useEffect(() => {
    if (!host.current) return;
    const theme = new Compartment();
    const appearance = () =>
      cssEditorTheme(document.documentElement.dataset.appearance === "light");
    const mounted = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: String(getGlobalContent("css", editor) ?? ""),
        extensions: [
          cssEditorSetup,
          theme.of(appearance()),
          css(),
          EditorView.lineWrapping,
          placeholder(help),
          EditorView.contentAttributes.of({ "aria-label": "Global CSS" }),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) =>
                transaction.annotation(controlledValue),
              )
            )
              editor.commands.setGlobalContent(
                "css",
                update.state.doc.toString(),
              );
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px", lineHeight: "1.5" },
            ".cm-scroller": {
              fontFamily: "monospace",
              fontSize: "13px",
              lineHeight: "1.4",
              overflow: "auto",
              scrollbarWidth: "thin",
            },
          }),
        ],
      }),
    });
    view.current = mounted;
    const observer = new MutationObserver(() =>
      mounted.dispatch({ effects: theme.reconfigure(appearance()) }),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-appearance"],
    });
    return () => {
      observer.disconnect();
      view.current = null;
      mounted.destroy();
    };
  }, [editor]);
  useEffect(() => {
    const mounted = view.current;
    if (mounted && mounted.state.doc.toString() !== currentCss)
      mounted.dispatch({
        changes: { from: 0, to: mounted.state.doc.length, insert: currentCss },
        annotations: controlledValue.of(true),
      });
  }, [currentCss]);
  return (
    <div className="overlay-content global-css-content">
      <div ref={host} className="global-css-editor" />
      <div className="css-presets">
        {presets.map((selector) => (
          <button
            type="button"
            key={selector}
            onClick={() => {
              const mounted = view.current;
              if (!mounted) return;
              const { from, to } = mounted.state.selection.ranges[0];
              mounted.dispatch({
                changes: { from, to, insert: `\n\n${selector} {\n  \n}\n` },
              });
            }}
          >
            {selector}
          </button>
        ))}
      </div>
    </div>
  );
}
