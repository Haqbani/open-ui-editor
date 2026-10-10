import { Icon } from "../shell/icons";

const nodeIcons: Record<string, string> = {
  button: "Button",
  codeBlock: "Code",
  htmlContent: "Code",
  section: "Section",
  horizontalRule: "Divider",
  dataTable: "Table",
  dataTableRow: "Minus",
  dataTableCell: "Square",
  footer: "Square",
  columnsColumn: "Square",
  twoColumns: "TwoColumns",
  threeColumns: "ThreeColumns",
  fourColumns: "FourColumns",
  image: "Image",
  youtube: "Youtube",
  twitter: "XTwitter",
  socialLinks: "Link",
  bulletList: "List",
  orderedList: "List",
  listItem: "Minus",
  blockquote: "Blockquote",
};
export function InspectorNodeTitle({
  type,
  children,
}: {
  type: string;
  children: React.ReactNode;
}) {
  return (
    <h2>
      <Icon
        name={
          type === "blockquote" ? "Blockquote" : `Header ${nodeIcons[type]}`
        }
        size={18}
      />
      {children}
    </h2>
  );
}
