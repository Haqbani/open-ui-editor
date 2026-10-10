import { expect, test } from "@playwright/test";
import { placeCaretAtFirstParagraphStart } from "../helpers/native-caret";

test("generatedHtmlCannotBeEdited", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  const code = page.locator(".code-pane-source .cm-content");
  await expect(code).toContainText("Welcome");
  await expect(code).toHaveAttribute("contenteditable", "false");
  const original = await code.textContent();
  await code.click();
  await page.keyboard.type("Cannot edit");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(code).toHaveText(original!);
  await expect(
    page.getByRole("button", { name: "Edit HTML", exact: true }),
  ).toBeDisabled();
});

test("copyUsesGeneratedEmailHtml", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  const code = page.locator(".code-pane-source .cm-content");
  await expect(code).toContainText("Welcome");
  const generated = (await code.locator(".cm-line").allTextContents()).join(
    "\n",
  );
  await page.getByRole("button", { name: "Copy HTML", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(generated);
});

test("modeSwitchDisposesCodeMirrorAndKeepsEditorHistory", async ({ page }) => {
  await page.goto("/");
  const body = page.getByTestId("email-editor").locator(".tiptap");
  await placeCaretAtFirstParagraphStart(body);
  await page.keyboard.type("Original ");
  await expect(body.locator("p").first()).toHaveText("Original Welcome");
  await body.evaluate((node) => Reflect.set(window, "__exportEditor", node));
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("navigation", { name: "Editor mode" })
      .getByRole("button", { name: "Code", exact: true })
      .click();
    await expect(page.locator(".code-pane-source .cm-editor")).toHaveCount(1);
    await expect(page.locator(".code-pane-source .cm-content")).toContainText(
      "Original Welcome",
    );
    await page.getByRole("button", { name: "Editor", exact: true }).click();
    await expect(page.locator(".code-pane-source .cm-editor")).toHaveCount(0);
  }
  expect(
    await body.evaluate(
      (node) => node === Reflect.get(window, "__exportEditor"),
    ),
  ).toBe(true);
  await body.focus();
  await page.keyboard.type("continued ");
  await expect(body).toContainText("Original continued Welcome");
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(body.locator("p").first()).toHaveText("Welcome");
});

test("generatedCodeUsesMeasuredSplitAndPreviewFillsCanvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  await expect(page.locator(".code-pane-source .cm-content")).toContainText(
    "Welcome",
  );
  expect(await page.locator(".code-pane-source").boundingBox()).toMatchObject({
    x: 72,
    y: 112,
    width: 560,
    height: 560,
  });
  const canvas = await page.getByTestId("editor-canvas").boundingBox();
  expect(canvas).toMatchObject({ x: 640, y: 60, width: 640, height: 620 });
  const preview = await page
    .locator('iframe[title="Email preview"]')
    .boundingBox();
  expect(preview!.y + preview!.height).toBeCloseTo(
    canvas!.y + canvas!.height,
    0,
  );
});
