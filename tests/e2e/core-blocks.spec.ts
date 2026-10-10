import { expect, test } from "@playwright/test";
import {
  createDocumentContract,
  validateDocument,
} from "../../src/editor/document-contract";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { createEditorExtensions } from "../helpers/extensions";

test("coreInsertionMatchesReferenceCases", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tiptap section p").click();
  const palette = page.getByTestId("insertion-palette");
  await expect(
    palette.getByRole("button", { name: "Text", exact: true }),
  ).toBeEnabled();
  await palette.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("menuitem", { name: "Text", exact: true }).click();
  await expect(page.locator(".tiptap section p")).toHaveCount(2);
  await expect(page.locator(".tiptap section p").last()).toHaveText("");
  await expect(page.locator(".tiptap")).toBeFocused();
  await page.keyboard.type("Inserted body");
  for (const [label, tag] of [
    ["Title", "h1"],
    ["Subtitle", "h2"],
    ["Heading", "h3"],
  ]) {
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator(`.tiptap section ${tag}`)).toHaveText("");
    await expect(page.locator(".tiptap")).toBeFocused();
    await page.keyboard.type(`Inserted ${label}`);
  }
  // The source closes a palette before opening another category by click.
  await page.keyboard.press("Escape");
  await palette
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Section", exact: true }).click();
  await expect(page.locator(".tiptap section section p")).toHaveText("");
  await expect(page.locator(".tiptap section section")).not.toHaveAttribute(
    "style",
    /padding/,
  );
  await page.keyboard.type("Nested insertion");
  await expect(page.locator(".tiptap section section p")).toHaveText(
    "Nested insertion",
  );
  await expect(
    page.locator(".tiptap p").filter({ hasText: "Read more" }),
  ).toHaveCount(1);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("open-ui-editor:local-draft:foundation")!)
        .document,
  );
  expect(
    validateDocument(saved, createDocumentContract(createEditorExtensions())),
  ).toMatchObject({ ok: true });
});

test("coreTypeConversionPreservesStrongAndUndoesOnce", async ({ page }) => {
  const document = createReferenceDocument();
  document.content![1].content![1] = {
    type: "heading",
    attrs: { level: 2 },
    content: [
      { type: "text", text: "Neutral subtitle", marks: [{ type: "bold" }] },
    ],
  };
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
  await page.locator(".tiptap h2").click();
  await page
    .getByRole("button", { name: "Change text type", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Subtitle", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("menuitem", { name: "Body", exact: true }),
  ).toBeEnabled();
  await page.getByRole("menuitem", { name: "Body", exact: true }).click();
  await expect(page.locator(".tiptap p strong")).toHaveText("Neutral subtitle");
  await expect(page.locator(".tiptap")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap h2 strong")).toHaveText(
    "Neutral subtitle",
  );
});

test("variablesEscapeReturnsTriggerFocus", async ({ page }) => {
  await page.goto("/");
  const trigger = page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Variables" });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.getByText("No variables available")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByText("No variables available")).not.toBeVisible();
});

test("schemaSupportedClassSurvivesTypeConversion", async ({ page }) => {
  const document = createReferenceDocument();
  document.content![1].content![1].attrs = {
    level: 1,
    class: "custom-heading",
  };
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
  await page.locator(".tiptap h1").click();
  await page
    .getByRole("button", { name: "Change text type", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Body", exact: true }).click();
  await expect(page.locator(".tiptap p.custom-heading")).toHaveText(
    "Template title",
  );
});
