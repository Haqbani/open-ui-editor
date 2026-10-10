import {
  defaultSlashCommands,
  filterAndRankItems,
  type SlashCommandItem,
} from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { createColumnsDocument } from "../blocks/columns";
import { createDataTableDocument } from "../blocks/data-table";
import { createFooterContent } from "../blocks/footer";
import { cachedSocialLinks } from "../blocks/social-links";
import { openAiPrompt } from "../services/editor-events";
import { startImageUploads } from "../services/image-upload";
import { Icon } from "./icons";
export type ApplicationSlashItem = SlashCommandItem & { shortcut?: string };
const shortcuts: Record<string, string> = {
  Title: "#",
  Subtitle: "##",
  Heading: "###",
  "Bullet list": "-",
  "Numbered list": "1.",
  Quote: ">",
  "Code block": "```",
};
const categories = ["Text", "Media", "Layout", "Utility"];
export function applicationSlashCommands(): ApplicationSlashItem[] {
  const extra: ApplicationSlashItem[] = [
    {
      icon: <Icon name="Image" size={20} />,
      title: "Image",
      description: "Upload an image from your computer.",
      searchTerms: ["photo", "picture", "media"],
      category: "Media",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.hidden = true;
        document.body.appendChild(input);
        const dispose = () => {
          input.onchange = null;
          input.oncancel = null;
          input.remove();
          editor.off("destroy", dispose);
        };
        editor.on("destroy", dispose);
        input.oncancel = dispose;
        input.onchange = () => {
          const files = Array.from(input.files ?? []);
          input.value = "";
          dispose();
          if (editor.isDestroyed || !files.length) return;
          // Both upload APIs take the raw ProseMirror insertion boundary.
          // Source command D reads from-1 only AFTER the chooser resolves.
          startImageUploads(files, editor, editor.state.selection.from - 1);
        };
        input.click();
      },
    },
    ...(
      [
        [
          "YouTube",
          "Embed a YouTube thumbnail",
          ["youtube", "video", "embed"],
          "Media",
          "youtube",
        ],
        [
          "X (former Twitter)",
          "Embed a X (Twitter) post",
          ["twitter", "x", "tweet", "post"],
          "Media",
          "twitter",
        ],
        [
          "Link Preview",
          "Embed a link preview card from any URL",
          ["link", "preview", "og", "card", "url", "embed"],
          "Media",
          "ogLinkPreview",
        ],
        [
          "Table",
          "Add a table with rows and columns",
          ["table", "grid", "rows", "columns", "data"],
          "Layout",
          "dataTable",
        ],
        [
          "Social Links",
          "LinkedIn, X, Discord, Slack, etc.",
          ["social", "links"],
          "Layout",
          "socialLinks",
        ],
        [
          "Unsubscribe Footer",
          "Add unsubscribe",
          ["footer", "unsubscribe"],
          "Layout",
          "footer",
        ],
        ["HTML", "Insert any custom code", ["html"], "Utility", "htmlContent"],
      ] as const
    ).map(([title, description, searchTerms, category, type]) => ({
      icon: <Icon name={title} size={20} />,
      title,
      description,
      searchTerms: [...searchTerms],
      category,
      command: ({
        editor,
        range,
      }: Parameters<SlashCommandItem["command"]>[0]) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            type === "dataTable"
              ? createDataTableDocument()
              : type === "footer"
                ? createFooterContent()
                : {
                    type,
                    ...(type === "socialLinks"
                      ? { attrs: { links: cachedSocialLinks(editor) } }
                      : {}),
                  },
          )
          .run(),
    })),
  ];
  return [
    {
      title: "Start from a prompt...",
      description: "Generate email content using AI",
      searchTerms: ["ai", "generate", "create", "write", "magic"],
      category: "Ai",
      shortcut: "/",
      icon: <Icon name="AI" size={20} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        openAiPrompt(editor, "slash");
      },
    },
    ...[...defaultSlashCommands, ...extra]
      .sort(
        (a, b) =>
          categories.indexOf(a.category ?? "") -
          categories.indexOf(b.category ?? ""),
      )
      .map((item) => ({
        ...item,
        ...(/^[234] columns$/.test(item.title)
          ? {
              command: ({
                editor,
                range,
              }: Parameters<SlashCommandItem["command"]>[0]) =>
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent(
                    createColumnsDocument(Number(item.title[0]) as 2 | 3 | 4),
                  )
                  .run(),
            }
          : {}),
        shortcut: shortcuts[item.title],
        icon: (
          <Icon
            name={item.title === "Code block" ? "Code" : item.title}
            size={20}
          />
        ),
      })),
  ];
}
export function filterApplicationCommands(
  items: ApplicationSlashItem[],
  query: string,
  editor: Editor,
) {
  const { $from } = editor.state.selection;
  const ancestors = Array.from(
    { length: $from.depth },
    (_, i) => $from.node(i + 1).type.name,
  );
  const depth = ancestors.filter((name) =>
    ["twoColumns", "threeColumns", "fourColumns"].includes(name),
  ).length;
  return filterAndRankItems(
    items.filter(
      (item) =>
        !(ancestors.includes("loop") && item.title === "Each Loop") &&
        (!ancestors.includes("dataTable") ||
          ["Text", "Image"].includes(item.title)) &&
        (depth < 3 || !item.title.toLowerCase().endsWith("columns")),
    ),
    query,
  );
}
