import { Inspector } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { Icon } from "../shell/icons";
export function Breadcrumb({ editor }: { editor: Editor }) {
  return (
    <Inspector.Breadcrumb>
      {(segments) => {
        // Source hierarchy includes Footer even though its schema is not selectable.
        // The installed public hierarchy filters it, so bridge only this captured node.
        const selection = editor.state.selection;
        const footers: { pos: number }[] = [];
        for (let d = 1; d <= selection.$from.depth; d++)
          if (selection.$from.node(d).type.name === "footer")
            footers.push({ pos: selection.$from.before(d) });
        if (
          selection instanceof NodeSelection &&
          selection.node.type.name === "footer"
        )
          footers.push({ pos: selection.from });
        const complete = [...segments];
        for (const { pos } of footers)
          if (!complete.some((segment) => segment.node.nodePos.pos === pos)) {
            const node = editor.state.doc.nodeAt(pos);
            if (!node) continue;
            complete.push({
              node: {
                nodeType: "footer",
                nodeAttrs: node.attrs,
                nodePos: { pos, inside: pos },
              },
              focus: () => editor.chain().focus().setNodeSelection(pos).run(),
            } as (typeof segments)[number]);
          }
        complete.sort((a, b) => a.node.nodePos.pos - b.node.nodePos.pos);
        return (
          <nav className="inspector-breadcrumb" aria-label="Selected block">
            {complete
              .filter((segment) =>
                [
                  "twoColumns",
                  "threeColumns",
                  "fourColumns",
                  "columnsColumn",
                  "dataTable",
                  "dataTableRow",
                  "dataTableCell",
                  "body",
                  "section",
                  "bulletList",
                  "orderedList",
                  "listItem",
                  "blockquote",
                  "footer",
                ].includes(segment.node.nodeType),
              )
              .map((segment, index) => (
                <span
                  key={`${segment.node.nodeType}:${segment.node.nodePos.pos}`}
                >
                  {index > 0 && " / "}
                  <button
                    type="button"
                    aria-label={
                      segment.node.nodeType === "body"
                        ? "Page style"
                        : `Select ${{ twoColumns: "2 Columns", threeColumns: "3 Columns", fourColumns: "4 Columns", columnsColumn: "Column", dataTable: "Table", dataTableRow: "Table Row", dataTableCell: "Table Cell", section: "Section", bulletList: "Bullet List", orderedList: "Ordered List", listItem: "List Item", footer: "Footer", blockquote: "Blockquote" }[segment.node.nodeType] ?? segment.node.nodeType}`
                    }
                    onClick={segment.focus}
                  >
                    {segment.node.nodeType === "body" && (
                      <Icon name="Select layout" />
                    )}
                    {segment.node.nodeType === "body"
                      ? "Page style"
                      : ({
                          twoColumns: "2 Columns",
                          threeColumns: "3 Columns",
                          fourColumns: "4 Columns",
                          columnsColumn: "Column",
                          dataTable: "Table",
                          dataTableRow: "Table Row",
                          dataTableCell: "Table Cell",
                          section: "Section",
                          bulletList: "Bullet List",
                          orderedList: "Ordered List",
                          listItem: "List Item",
                          footer: "Footer",
                          blockquote: "Blockquote",
                        }[segment.node.nodeType] ?? segment.node.nodeType)}
                  </button>
                </span>
              ))}
          </nav>
        );
      }}
    </Inspector.Breadcrumb>
  );
}
