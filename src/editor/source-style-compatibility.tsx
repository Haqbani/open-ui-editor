import { EmailMark } from "@react-email/editor/core";
import { Extension } from "@tiptap/core";
import { Color, TextStyle } from "@tiptap/extension-text-style";

/** The deployed source uses the public TextStyle + Color pair. Keep its JSON
 * identity while supplying the email serializer required by our document contract.
 * PreservedStyle remains registered for existing drafts and non-color CSS. */
export const EmailTextStyle = EmailMark.from(
  TextStyle,
  ({ mark, children }) => (
    <span style={{ color: mark.attrs?.color ?? undefined }}>{children}</span>
  ),
);
export const SourceColor = Color;

/** Passive source metadata only; this does not start a collaboration provider. */
export const SourceStyleAttributes = Extension.create({
  name: "sourceStyleAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: { ychange: { default: null, rendered: false } },
      },
    ];
  },
});
