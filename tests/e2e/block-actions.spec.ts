import { expect, type Page, test } from "@playwright/test";
import { createReferenceDocument } from "../../src/editor/reference-document";

async function menu(page: Page, text: string, index = 0) {
  await page
    .locator(".tiptap p,.tiptap h1,.tiptap h2,.tiptap h3")
    .filter({ hasText: new RegExp(`^${text}$`) })
    .nth(index)
    .hover();
  const handle = page.getByRole("button", {
    name: "Block actions",
    exact: true,
  });
  await handle.click();
  return handle;
}
test("blockActionsResolveCurrentPosition", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".block-action-handle")).toBeAttached();
  await menu(page, "Welcome");
  await page.getByRole("menuitem", { name: "Move down", exact: true }).click();
  await expect(
    page
      .locator(".tiptap .node-container > .react-renderer")
      .nth(0)
      .locator("h1"),
  ).toHaveText("Template title");
  await menu(page, "Welcome");
  await page.getByRole("menuitem", { name: /^Duplicate/ }).click();
  await expect(
    page.locator(".tiptap p").filter({ hasText: /^Welcome$/ }),
  ).toHaveCount(2);
  await menu(page, "Welcome", 1);
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  await expect(
    page.locator(".tiptap p").filter({ hasText: /^Welcome$/ }),
  ).toHaveCount(1);
  await expect(page.locator(".tiptap")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.locator(".tiptap p").filter({ hasText: /^Welcome$/ }),
  ).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.locator(".tiptap p").filter({ hasText: /^Welcome$/ }),
  ).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page
      .locator(".tiptap .node-container > .react-renderer")
      .first()
      .locator("p"),
  ).toHaveText("Welcome");
});
test("moveBoundariesMatchReferenceAndMenuEscape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".block-action-handle")).toBeAttached();
  const handle = await menu(page, "Welcome");
  await expect(
    page.getByRole("menuitem", { name: "Move up", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("menuitem", { name: "Move down", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(handle).toBeFocused();
  await menu(page, "Read more");
  await expect(
    page.getByRole("menuitem", { name: "Move down", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await menu(page, "Section content");
  await expect(page.getByRole("menuitem", { name: /^Delete/ })).toBeEnabled();
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  await expect(page.locator(".tiptap .node-section")).not.toContainText(
    "Section content",
  );
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap .node-section")).toContainText(
    "Section content",
  );
});
test("metadataShortcutsDoNotRunBlockCommands", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tiptap h1").click();
  const before = await page.locator(".tiptap").innerText();
  const subject = page.getByRole("textbox", { name: "Subject", exact: true });
  await subject.fill("Neutral subject");
  await subject.press("ControlOrMeta+d");
  await expect(subject).toHaveValue("Neutral subject");
  await subject.press("End");
  await subject.press("Backspace");
  await subject.press("Home");
  await subject.press("Delete");
  await expect(subject).toHaveValue("eutral subjec");
  expect(await page.locator(".tiptap").innerText()).toBe(before);
});

test("nestedDragMovesHeadingAndRejectsAncestorDrop", async ({ page }) => {
  const document = createReferenceDocument();
  document.content![1].content = [
    {
      type: "section",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Outer body" }] },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Neutral heading" }],
        },
        {
          type: "section",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Nested neutral text" }],
            },
          ],
        },
        { type: "paragraph" },
      ],
    },
    { type: "paragraph" },
  ];
  await page.addInitScript(
    (document) =>
      localStorage.setItem(
        "open-ui-editor:local-draft:foundation",
        JSON.stringify({
          id: "foundation",
          title: "Neutral template",
          revision: 0,
          metadata: { from: "", replyTo: "", subject: "", previewText: "" },
          document,
        }),
      ),
    document,
  );
  await page.goto("/");
  await expect(page.locator(".block-action-handle")).toBeAttached();
  await page.locator(".tiptap h3").hover();
  const drag = page.getByRole("button", { name: "Block actions", exact: true });
  await expect(drag).toBeVisible();
  await expect(drag).toHaveAttribute("aria-description", "heading");
  const nestedParagraph = page.locator(".tiptap section section p");
  const target = await nestedParagraph.boundingBox();
  if (!target) throw new Error("Missing paragraph");
  await drag.dragTo(nestedParagraph, {
    targetPosition: { x: 80, y: target.height - 1 },
  });
  await expect(page.locator(".tiptap section section h3")).toHaveText(
    "Neutral heading",
  );
  await expect(
    page.locator(".tiptap section section .ProseMirror-selectednode h3"),
  ).toHaveText("Neutral heading");
  await expect(nestedParagraph.last()).toHaveText("");
  await page.locator(".tiptap").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap section section h3")).toHaveCount(0);
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("open-ui-editor:local-draft:foundation")!)
        .document,
  );
  // Current deployed source explicitly excludes structural Section handles.
  await page
    .locator(".tiptap section")
    .first()
    .hover({ position: { x: 2, y: 25 } });
  await expect(drag).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("open-ui-editor:local-draft:foundation")!,
        ).document,
    ),
  ).toEqual(before);
  await expect(nestedParagraph).toHaveText("Nested neutral text");
});

test("soleChildNativeMoveLetsProseMirrorFillRequiredSection", async ({
  page,
}) => {
  await page.goto("/");
  const paragraph = page.locator(".tiptap section p");
  await paragraph.hover();
  const drag = page.getByRole("button", { name: "Block actions", exact: true });
  await expect(drag).toHaveAttribute("aria-description", "paragraph");
  const first = page.locator(".tiptap p").first();
  const box = await first.boundingBox();
  if (!box) throw new Error("Missing target");
  await drag.dragTo(first, { targetPosition: { x: 80, y: box.height - 1 } });
  await expect(paragraph).toHaveText("");
  await expect(
    page
      .locator(".tiptap .node-container p")
      .filter({ hasText: /^Section content$/ }),
  ).toHaveCount(1);
});
