import {
  Button,
  CodeBlockPrism,
  Divider,
} from "@react-email/editor/extensions";
import type { Editor, NodeViewProps } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import {
  type BlockTarget,
  dispatchBlockTransaction,
  resolveBlock,
  resolveBlockTarget,
} from "./commands";
import { useSemanticStyle } from "./core-node-views";

export const basicFamilyExtensions = {
  button: Button.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ButtonView, {
        contentDOMElementTag: "span",
        trackNodeViewPosition: true,
        attrs: { class: "react-renderer core-node-view" },
      });
    },
  }),
  horizontalRule: Divider,
  codeBlock: CodeBlockPrism.configure({
    defaultLanguage: "javascript",
    defaultTheme: "default",
    HTMLAttributes: { class: "prism node-codeBlock" },
  }),
};
export function insertBasicFamily(
  editor: Editor,
  kind: "button" | "horizontalRule",
  target: BlockTarget | null = resolveBlockTarget(editor),
) {
  if (!target) return false;
  const r = resolveBlock(editor, target);
  if (!r) return false;
  const node = editor.schema.nodes[kind].createChecked(
    null,
    kind === "button" ? editor.schema.text("Button") : undefined,
  );
  if (!r.parent.canReplace(r.index + 1, r.index + 1, Fragment.from(node)))
    return false;
  const pos = target.pos + r.node.nodeSize;
  const tr = editor.state.tr.insert(pos, node);
  if (kind === "button") tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  else tr.setSelection(Selection.near(tr.doc.resolve(pos + node.nodeSize), 1));
  return dispatchBlockTransaction(editor, tr);
}

/** Captured public getUrlFromString/isSafeUrl plus the popup's variable/removal rules. */
export function normalizeButtonLink(input: string): string | null {
  const value = input.trim();
  if (!value || value === "#") return value;
  const safe = (url: string) => {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: captured URL safety contract removes control characters.
    const stripped = url.replace(/[\s\u0000-\u001F\u007F]/g, "");
    if (!stripped || stripped.startsWith("//")) return false;
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(stripped))
      return true;
    try {
      return ![
        "javascript:",
        "vbscript:",
        "data:",
        "file:",
        "blob:",
        "about:",
      ].includes(new URL(stripped).protocol);
    } catch {
      return true;
    }
  };
  try {
    new URL(value);
    return safe(value) ? value : null;
  } catch {
    /* Try the captured domain shorthand below. */
  }
  if (/^\s*\{\{\{[^}]+\}\}\}\s*$/.test(value)) return value;
  if (/\{\{\{([^}]+)\}\}\}/.test(value)) return null;
  try {
    if (value.includes(".") && !value.includes(" ")) {
      const url = new URL(`https://${value}`).toString();
      return safe(url) ? url : null;
    }
  } catch {
    return null;
  }
  return null;
}

function ButtonView({ node }: NodeViewProps) {
  // Automatic alignment belongs to the wrapper; declared anchor CSS stays own.
  const ref = useSemanticStyle<HTMLAnchorElement>(node, false);
  return (
    <NodeViewWrapper
      className={`core-block align-${node.attrs.alignment}`}
      style={{ position: "relative", textAlign: node.attrs.alignment }}
    >
      {/* biome-ignore lint/a11y/useValidAnchor: editable email node stores its destination in data-href, matching the public Button DOM. */}
      <a
        ref={ref}
        className={`node-button ${node.attrs.class ?? ""}`}
        data-id="react-email-button"
        data-href={node.attrs.href}
      >
        <NodeViewContent<"span"> as="span" />
      </a>
    </NodeViewWrapper>
  );
}
