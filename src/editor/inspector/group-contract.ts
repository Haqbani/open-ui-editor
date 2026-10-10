// Captured public module 883398, deployed-inspector-group-configuration-contract.json.
export const groupProperties = {
  text: [
    "color",
    "font-size",
    "font-weight",
    "letter-spacing",
    "line-height",
    "text-decoration",
  ],
  size: ["width", "height", "box-sizing"],
  padding: [
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
  ],
  margin: [
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
  ],
  background: ["background-color"],
  border: [
    "border-radius",
    "border-width",
    "border-color",
    "border-style",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-top-width",
    "border-top-color",
    "border-top-style",
    "border-right-width",
    "border-right-color",
    "border-right-style",
    "border-bottom-width",
    "border-bottom-color",
    "border-bottom-style",
    "border-left-width",
    "border-left-color",
    "border-left-style",
  ],
};
export const globalGroups: Record<string, string[]> = {
  typography: ["text"],
  h1: ["text", "padding"],
  h2: ["text", "padding"],
  h3: ["text", "padding"],
  paragraph: ["text", "padding"],
  list: ["text"],
  "list-item": ["text"],
  "nested-list": ["text"],
  link: ["text"],
  image: ["border"],
  button: ["text", "padding", "background", "border"],
  "code-block": ["padding", "border"],
  "inline-code": ["text", "background", "border"],
};
export const nodeGroups: Record<
  string,
  { expanded: string[]; collapsed: string[] }
> = {
  paragraph: {
    expanded: ["alignment", "text", "padding"],
    collapsed: ["background", "border"],
  },
  heading: {
    expanded: ["alignment", "text", "padding"],
    collapsed: ["background", "border"],
  },
  blockquote: {
    expanded: ["padding"],
    collapsed: ["text", "background", "border"],
  },
  image: {
    expanded: ["alignment", "size", "padding", "border"],
    collapsed: ["link"],
  },
  youtube: {
    expanded: ["alignment", "padding"],
    collapsed: ["size", "border"],
  },
  twitter: {
    expanded: ["alignment", "padding"],
    collapsed: ["size", "border"],
  },
  button: {
    expanded: ["alignment", "link", "text", "padding"],
    collapsed: ["size", "border", "background"],
  },
  codeBlock: { expanded: ["padding"], collapsed: ["border"] },
  section: {
    expanded: ["background", "text", "padding"],
    collapsed: ["border"],
  },
  footer: { expanded: ["padding"], collapsed: ["text", "background"] },
  bulletList: {
    expanded: ["alignment", "text", "padding"],
    collapsed: ["border"],
  },
  orderedList: {
    expanded: ["alignment", "text", "padding"],
    collapsed: ["border"],
  },
  listItem: { expanded: ["text", "padding"], collapsed: ["border"] },
  twoColumns: {
    expanded: ["text", "padding"],
    collapsed: ["background", "border"],
  },
  threeColumns: {
    expanded: ["text", "padding"],
    collapsed: ["background", "border"],
  },
  fourColumns: {
    expanded: ["text", "padding"],
    collapsed: ["background", "border"],
  },
  columnsColumn: {
    expanded: ["size", "text", "padding"],
    collapsed: ["background", "border"],
  },
  dataTable: {
    expanded: ["padding"],
    collapsed: ["text", "background", "border"],
  },
  dataTableRow: { expanded: [], collapsed: [] },
  dataTableCell: { expanded: [], collapsed: [] },
  socialLinks: { expanded: [], collapsed: [] },
  horizontalRule: { expanded: ["padding"], collapsed: [] },
  htmlContent: { expanded: ["padding"], collapsed: ["size", "border"] },
};
