import { StarterKit } from "@react-email/editor/extensions";
import { EmailTheming } from "@react-email/editor/plugins";
import type { AnyExtension, Extensions, JSONContent } from "@tiptap/core";
import { BlockSessionRevision } from "./blocks/commands";
import { extendImage } from "./blocks/image";
import { getBlockDefinitions } from "./blocks/registry";
import { ToolbarDrop } from "./blocks/toolbar-drop";
import { createLocalHistory } from "./history/local-history";
import {
  EmailTextStyle,
  SourceColor,
  SourceStyleAttributes,
} from "./source-style-compatibility";
import type { DocumentContract } from "./types";

export function createEditorExtensions(
  image: AnyExtension,
  localHistory?: { document: JSONContent; contract: DocumentContract },
): Extensions {
  return [
    BlockSessionRevision,
    EmailTextStyle,
    SourceColor,
    SourceStyleAttributes,
    ToolbarDrop,
    extendImage(image),
    StarterKit.configure({
      ...(localHistory ? { UndoRedo: false as const } : {}),
      StyleAttribute: {
        types: [
          ...(StarterKit.options.StyleAttribute === false
            ? []
            : (StarterKit.options.StyleAttribute?.types ?? [])),
          "container",
        ],
      },
      TwoColumns: false,
      ThreeColumns: false,
      FourColumns: false,
      ColumnsColumn: false,
      Paragraph: false,
      Heading: false,
      Section: false,
      Button: false,
      Divider: false,
      CodeBlockPrism: false,
      BulletList: false,
      OrderedList: false,
      ListItem: false,
      Blockquote: false,
    }),
    ...new Map(
      getBlockDefinitions()
        .filter((definition) => definition.nodeType !== "image")
        .flatMap((definition) =>
          definition.extension
            ? [[definition.nodeType, definition.extension] as const]
            : [],
        ),
    ).values(),
    EmailTheming.configure({}),
    ...(localHistory
      ? [createLocalHistory(localHistory.document, localHistory.contract)]
      : []),
  ];
}
