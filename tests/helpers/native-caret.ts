import { expect, type Locator } from "@playwright/test";

/** Establish this continuity test's initial caret using measured browser glyph geometry.
 * Native center-click/Home setup was unstable under full parallel workers; these tests cover
 * persistent editor/history/storage, with caret identity asserted before typing.
 */
export async function placeCaretAtFirstParagraphStart(editable: Locator) {
  const paragraph = editable.locator("p").first();
  await expect(paragraph).toHaveText("Welcome");
  const position = await paragraph.evaluate((node) => {
    const text = document
      .createTreeWalker(node, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!text) throw new Error("Missing initial paragraph text");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const glyph = range.getBoundingClientRect();
    const block = node.getBoundingClientRect();
    return {
      // The source handle hit area reaches 2px into the block gutter.
      // First-quarter glyph remains on the start side of the native caret.
      x: glyph.x - block.x + glyph.width / 4,
      y: glyph.y - block.y + glyph.height / 2,
    };
  });
  await paragraph.click({ position });
  await expect
    .poll(() =>
      paragraph.evaluate((node) => {
        const selection = getSelection();
        return {
          nodeType: selection?.anchorNode?.nodeType,
          text: selection?.anchorNode?.textContent,
          inside: Boolean(
            selection?.anchorNode && node.contains(selection.anchorNode),
          ),
          offset: selection?.anchorOffset,
          active: document.activeElement?.getAttribute("aria-label"),
        };
      }),
    )
    .toMatchObject({
      nodeType: 3,
      text: "Welcome",
      inside: true,
      offset: 0,
      active: "Email body",
    });
}
