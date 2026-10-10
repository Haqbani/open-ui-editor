import { expect, test } from "@playwright/test";
import { createReferenceDocument } from "../../src/editor/reference-document";

test("exportsNeutralDocumentWithoutEditorChrome", async ({ page }) => {
  await page.goto("/");
  const body = page.getByTestId("email-editor").locator(".tiptap");
  await body.locator("h1").click();
  await expect(page.getByTestId("editor-inspector")).toBeVisible();
  await page.getByRole("button", { name: "Preview text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Preview", exact: true })
    .fill("Neutral preview");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  const code = page.locator(".code-pane-source .cm-content");
  await expect(code).toContainText("Neutral preview");
  const html = (await code.locator(".cm-line").allTextContents()).join("\n");
  for (const text of [
    "Welcome",
    "Template title",
    "Section content",
    "https://example.com",
    "600px",
    'role="presentation"',
  ])
    expect(html).toContain(text);
  expect(html).not.toMatch(
    /ProseMirror|contenteditable|data-node-view|editor-inspector|insertion-palette/,
  );
  const frame = page.frameLocator('iframe[title="Email preview"]');
  await expect(frame.locator("h1")).toHaveText("Template title");
  await expect(frame.getByRole("link", { name: "Read more" })).toHaveAttribute(
    "href",
    "https://example.com",
  );
  await expect(frame.locator("body")).toContainText("Section content");
  expect(await page.locator("iframe").getAttribute("srcdoc")).not.toMatch(
    /ProseMirror|contenteditable|data-node-view|editor-inspector/,
  );
});

test("emailCssStaysInsideIsolatedPreview", async ({ page }) => {
  const document = createReferenceDocument();
  document.content![0].attrs!.data.css =
    "h1 { color: rgb(12, 34, 56) !important; }";
  await page.addInitScript((document) => {
    localStorage.setItem(
      "open-ui-editor:local-draft:foundation",
      JSON.stringify({
        id: "foundation",
        title: "Neutral template",
        metadata: { from: "", replyTo: "", subject: "", previewText: "" },
        document,
        revision: 1,
      }),
    );
  }, document);
  await page.goto("/");
  await page.evaluate(() => {
    const heading = document.createElement("h1");
    heading.id = "isolation-probe";
    heading.textContent = "Parent";
    document.body.append(heading);
  });
  const parentColor = await page
    .locator("#isolation-probe")
    .evaluate((node) => getComputedStyle(node).color);
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  const iframe = page.locator('iframe[title="Email preview"]');
  await expect(iframe).toHaveAttribute("sandbox", "");
  await expect(
    page.frameLocator('iframe[title="Email preview"]').locator("h1"),
  ).toHaveCSS("color", "rgb(12, 34, 56)");
  await expect(page.locator("#isolation-probe")).toHaveCSS(
    "color",
    parentColor,
  );
});
