import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Public source module 458451's vesperInit settings and token map.
export function cssEditorTheme(light: boolean) {
  const foreground = light ? "#24292e" : "#FFF";
  const selection = light ? "#0366d620" : "#FFFFFF25";
  const highlights = HighlightStyle.define([
    { tag: tags.comment, color: light ? "#6a737d" : "#8b8b8b94" },
    { tag: tags.variableName, color: foreground },
    { tag: tags.keyword, color: light ? "#d73a49" : "#A0A0A0" },
    {
      tag: tags.function(tags.variableName),
      color: light ? "#6f42c1" : "#FFC799",
    },
    { tag: tags.string, color: light ? "#032f62" : "#99FFE4" },
    { tag: tags.literal, color: light ? "#005cc5" : "#FFC799" },
    { tag: tags.typeName, color: light ? "#6f42c1" : "#FFC799" },
    { tag: tags.propertyName, color: light ? "#005cc5" : "#FFC799" },
    { tag: tags.operator, color: light ? "#d73a49" : "#A0A0A0" },
    {
      tag: [tags.meta, tags.attributeName],
      color: light ? "#6f42c1" : "#A0A0A0",
    },
    { tag: tags.className, color: light ? "#6f42c1" : "#fff" },
    { tag: tags.tagName, color: light ? "#22863a" : "#A0A0A0" },
    { tag: tags.regexp, color: light ? "#032f62" : "#99C592" },
    { tag: [tags.heading, tags.atom], color: light ? "#005cc5" : "#FFC799" },
    { tag: tags.strong, fontStyle: "bold", color: foreground },
    { tag: tags.emphasis, fontStyle: "italic", color: foreground },
    {
      tag: tags.link,
      color: light ? "#0366d6" : "#FFC799",
      fontStyle: "underline",
    },
  ]);
  return [
    EditorView.theme(
      {
        "&": {
          backgroundColor: light ? "#f0f0f0" : "#05050A",
          color: foreground,
        },
        ".cm-gutters": {
          backgroundColor: light ? "#f0f0f0" : "#000",
          color: light ? "#6a737d" : "#505050",
          borderRightWidth: "0px !important",
        },
        ".cm-content": { caretColor: "#61a8f8" },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#61a8f8" },
        ".cm-activeLine, .cm-activeLineGutter": {
          backgroundColor: "transparent",
        },
        "&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, & .cm-content ::selection":
          {
            background: `${selection} !important`,
            color: `${foreground} !important`,
          },
        "& .cm-selectionMatch": { backgroundColor: selection },
      },
      { dark: !light },
    ),
    syntaxHighlighting(highlights),
  ];
}
