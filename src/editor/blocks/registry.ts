import { Heading, Paragraph, Section } from "@react-email/editor/extensions";
import type { AnyExtension, Editor, JSONContent } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { chooseImage } from "../services/image-upload";
import { getEditorStorage } from "../storage/editor-storage";
import { basicFamilyExtensions, insertBasicFamily } from "./basic-family";
import {
  columnsExtensions,
  createColumnsDocument,
  insertLayoutDocument,
} from "./columns";
import {
  type BlockTarget,
  type CoreBlockKind,
  insertCoreBlock,
  resolveBlock,
} from "./commands";
import { HeadingView, ParagraphView, SectionView } from "./core-node-views";
import {
  createDataTableDocument,
  createDataTableExtension,
  DataTableCell,
  DataTableRow,
} from "./data-table";
import { createFooterContent, Footer } from "./footer";
import { Html } from "./html";
import { OgLinkPreview } from "./link-preview";
import { Twitter, YouTube } from "./media";
import { cachedSocialLinks, SocialLinks } from "./social-links";
import { convertTextFamily, textFamilyExtensions } from "./text-family";

const paragraph = Paragraph.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ParagraphView, {
      contentDOMElementTag: "span",
      trackNodeViewPosition: true,
      attrs: { class: "react-renderer core-node-view" },
    });
  },
}).configure({ HTMLAttributes: { class: "node-paragraph" } });
const heading = Heading.extend({
  addNodeView() {
    return ReactNodeViewRenderer(HeadingView, {
      trackNodeViewPosition: true,
      attrs: { class: "react-renderer core-node-view" },
    });
  },
});
const section = Section.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SectionView, {
      trackNodeViewPosition: true,
      attrs: { class: "react-renderer core-node-view" },
    });
  },
});
export type CoreBlockDefinition = {
  kind: CoreBlockKind;
  nodeType: CoreBlockKind;
  menuLabel: string;
  headingLevel?: number;
  extension: AnyExtension;
  insert: (editor: Editor) => boolean;
};
export function getCoreBlockDefinitions(): CoreBlockDefinition[] {
  return [
    {
      kind: "paragraph",
      nodeType: "paragraph",
      menuLabel: "Text",
      extension: paragraph,
      insert: (editor) => insertCoreBlock(editor, "paragraph"),
    },
    ...(["Title", "Subtitle", "Heading"] as const).map(
      (menuLabel, index): CoreBlockDefinition => ({
        kind: "heading",
        nodeType: "heading",
        menuLabel,
        headingLevel: index + 1,
        extension: heading,
        insert: (editor) =>
          insertCoreBlock(editor, "heading", { headingLevel: index + 1 }),
      }),
    ),
    {
      kind: "section",
      nodeType: "section",
      menuLabel: "Section",
      extension: section,
      insert: (editor) => insertCoreBlock(editor, "section"),
    },
  ];
}

export type BlockDefinition = {
  dragId?: string;
  createDragContent?: (editor: Editor) => JSONContent | JSONContent[] | null;
  runDragAt?: (editor: Editor, pos: number) => boolean;
  id: string;
  nodeType: string;
  menuLabel: string;
  extension?: AnyExtension;
  execute: (editor: Editor, target: BlockTarget | null) => boolean;
};
function cachedTwitterDarkMode(editor: Editor) {
  try {
    return (
      getEditorStorage(editor).getItem("open-ui-editor-twitter-dark-mode") ===
      "true"
    );
  } catch {
    return false;
  }
}
export function getBlockDefinitions(): readonly BlockDefinition[] {
  const definitions: BlockDefinition[] = [
    {
      id: "image",
      nodeType: "image",
      menuLabel: "Image",
      // Image schema is supplied by the stable useEditorImage hook, separately.

      dragId: "media:image",
      runDragAt: (editor, pos) => chooseImage(editor, pos),
      execute: (editor) => chooseImage(editor),
    },
    ...(
      [
        [Html, "HTML"],
        [Footer, "Unsubscribe Footer"],
        [SocialLinks, "Social Links"],
        [YouTube, "YouTube"],
        [OgLinkPreview, "Link Preview"],
        [Twitter, "X (Twitter)"],
      ] as const
    ).map(([extension, menuLabel]) => ({
      id: extension.name,
      nodeType: extension.name,
      menuLabel,
      extension,

      execute: (editor: Editor, target: BlockTarget | null) =>
        !!target &&
        !!resolveBlock(editor, target) &&
        editor
          .chain()
          .focus()
          .insertContent(
            extension.name === "footer"
              ? createFooterContent()
              : {
                  type: extension.name,
                  ...(extension.name === "socialLinks"
                    ? { attrs: { links: cachedSocialLinks(editor) } }
                    : extension.name === "twitter"
                      ? {
                          attrs: {
                            internal_darkMode: cachedTwitterDarkMode(editor),
                          },
                        }
                      : {}),
                },
          )
          .run(),
    })),
    ...([2, 3, 4] as const).map((count) => ({
      id: `columns-${count}`,
      nodeType: { 2: "twoColumns", 3: "threeColumns", 4: "fourColumns" }[count],
      menuLabel: `${count} columns`,
      extension:
        columnsExtensions[
          createColumnsDocument(count).type as
            | "twoColumns"
            | "threeColumns"
            | "fourColumns"
        ],

      execute: (editor: Editor, target: BlockTarget | null) =>
        insertLayoutDocument(editor, target, createColumnsDocument(count)),
    })),
    {
      id: "columnsColumn",
      nodeType: "columnsColumn",
      menuLabel: "Column",
      extension: columnsExtensions.columnsColumn,

      execute: () => false,
    },
    {
      id: "dataTable",
      nodeType: "dataTable",
      menuLabel: "Table",
      extension: createDataTableExtension(),

      execute: (editor: Editor, target: BlockTarget | null) =>
        insertLayoutDocument(editor, target, createDataTableDocument()),
    },
    ...[DataTableRow, DataTableCell].map((extension) => ({
      id: extension.name,
      nodeType: extension.name,
      menuLabel: extension.name,
      extension,

      execute: () => false,
    })),
    ...getCoreBlockDefinitions().map((definition) => ({
      id: definition.headingLevel
        ? `heading-${definition.headingLevel}`
        : definition.kind,
      nodeType: definition.nodeType,
      menuLabel: definition.menuLabel,

      extension: definition.extension,
      execute: (editor: Editor, target: BlockTarget | null) =>
        !!target &&
        !!resolveBlock(editor, target) &&
        insertCoreBlock(
          editor,
          definition.kind,
          definition.headingLevel
            ? { headingLevel: definition.headingLevel }
            : undefined,
          target,
        ),
    })),
    ...(
      [
        ["bulletList", "Bullet list", "bullet-list-default"],
        ["orderedList", "Numbered list", "ordered-list-default"],
        ["blockquote", "Quote", "blockquote-toggle"],
      ] as const
    ).map(([nodeType, menuLabel]) => ({
      id: nodeType,
      nodeType,
      menuLabel,
      extension: textFamilyExtensions[nodeType],

      execute: (editor: Editor, target: BlockTarget | null) =>
        convertTextFamily(editor, nodeType, target),
    })),
    {
      id: "listItem",
      nodeType: "listItem",
      menuLabel: "List Item",
      extension: textFamilyExtensions.listItem,

      execute: () => false,
    },
    ...(
      [
        ["button", "Button", "button-default"],
        ["horizontalRule", "Divider", "divider-default"],
        ["codeBlock", "Code", "code-block-default"],
      ] as const
    ).map(([nodeType, menuLabel]) => ({
      id: nodeType,
      nodeType,
      menuLabel,
      extension: basicFamilyExtensions[nodeType],

      execute: (editor: Editor, target: BlockTarget | null) =>
        nodeType === "codeBlock"
          ? convertTextFamily(editor, nodeType, target)
          : insertBasicFamily(editor, nodeType, target),
    })),
  ];
  return definitions.map((definition) => {
    const names: Record<string, string> = {
      htmlContent: "comp:html",
      socialLinks: "comp:social-links",
      footer: "comp:footer",
      youtube: "media:youtube",
      twitter: "media:twitter",
      paragraph: "text:paragraph",
      "heading-1": "text:heading-1",
      "heading-2": "text:heading-2",
      "heading-3": "text:heading-3",
      bulletList: "text:bullet-list",
      orderedList: "text:ordered-list",
      button: "comp:button",
      horizontalRule: "comp:divider",
      section: "comp:section",
      codeBlock: "comp:code",
      dataTable: "comp:table",
      "columns-2": "comp:columns-2",
      "columns-3": "comp:columns-3",
      "columns-4": "comp:columns-4",
    };
    const dragId = names[definition.id];
    if (!dragId) return definition;
    return {
      ...definition,
      dragId,
      createDragContent: (editor) => {
        if (definition.nodeType === "footer") return createFooterContent();
        if (definition.nodeType === "socialLinks")
          return {
            type: "socialLinks",
            attrs: { links: cachedSocialLinks(editor) },
          };
        if (definition.nodeType === "twitter")
          return {
            type: "twitter",
            attrs: { internal_darkMode: cachedTwitterDarkMode(editor) },
          };
        if (definition.id.startsWith("columns-"))
          return createColumnsDocument(
            Number(definition.id.slice(-1)) as 2 | 3 | 4,
          );
        if (definition.nodeType === "dataTable")
          return createDataTableDocument();
        if (definition.id.startsWith("heading-"))
          return {
            type: "heading",
            attrs: { level: Number(definition.id.slice(-1)) },
          };
        if (["bulletList", "orderedList"].includes(definition.nodeType))
          return {
            type: definition.nodeType,
            content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
          };
        if (definition.nodeType === "section")
          return { type: "section", content: [{ type: "paragraph" }] };
        if (definition.nodeType === "button")
          return {
            type: "button",
            content: [{ type: "text", text: "Button" }],
          };
        return { type: definition.nodeType };
      },
    };
  });
}
