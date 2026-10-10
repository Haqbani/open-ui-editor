import { useEditorImage } from "@react-email/editor/plugins";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEditorExtensions as create } from "../../src/editor/extensions";
export function createEditorExtensions(
  localHistory?: Parameters<typeof create>[1],
) {
  let extensions: ReturnType<typeof create> = [];
  function Capture() {
    const image = useEditorImage({
      uploadImage: async () => {
        throw new Error("No upload adapter in tests");
      },
    });
    extensions = create(image, localHistory);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return extensions;
}
