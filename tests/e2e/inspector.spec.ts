import { expect, test } from "@playwright/test";
import { createReferenceDocument } from "../../src/editor/reference-document";

test.use({ viewport: { width: 1280, height: 720 } });

test("selectionRoutesDocumentTextAndSection", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByTestId("editor-inspector");
  await expect(
    panel.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("600");
  await page.locator(".tiptap h1").click();
  await expect(
    panel.getByRole("heading", { name: "Title", exact: true }),
  ).toBeVisible();
  const fields = panel.locator(".typography-controls input");
  await expect(fields).toHaveCount(4);
  expect(
    await fields.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("aria-label")),
    ),
  ).toEqual(["Color", "Font size", "Line height", "Letter spacing"]);
  await page.locator(".tiptap section p").click();
  await panel
    .getByRole("button", { name: "Select Section", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Section", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".tiptap")).toBeFocused();
  await panel.getByRole("button", { name: "Page style", exact: true }).click();
  await expect(
    panel.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("600");
});

test("documentWidthRetainsNumberWhenUnitChanges", async ({ page }) => {
  await page.goto("/");
  const width = page.getByRole("textbox", { name: "Width", exact: true });
  await expect(width).toHaveValue("600");
  await page.getByRole("combobox", { name: "Width unit", exact: true }).click();
  await page.getByRole("option", { name: "%", exact: true }).click();
  await expect(width).toHaveValue("600");
  await expect(
    page.getByRole("combobox", { name: "Width unit" }),
  ).toBeFocused();
  await expect(page.locator(".node-container")).toHaveCSS("width", "3600px");
  await page.getByRole("combobox", { name: "Width unit" }).click();
  await page.getByRole("option", { name: "px", exact: true }).click();
  await expect(page.locator(".node-container")).toHaveCSS("width", "600px");
});

test("explicitZeroAndInheritedStyleRemainDistinct", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tiptap section p").click();
  await page
    .getByRole("button", { name: "Select Section", exact: true })
    .click();
  const section = page.locator(".tiptap section");
  const top = page.getByRole("textbox", { name: "Padding top", exact: true });
  await expect(top).toHaveValue("10");
  await top.fill("0");
  await expect(section).toHaveCSS("padding-top", "10px");
  await top.press("Enter");
  await expect(section).toHaveCSS("padding-top", "0px");
  await expect(section).toHaveCSS("padding-right", "20px");
  await expect(section).toHaveCSS("padding-bottom", "10px");
  await expect(top).toHaveValue("0");
  await expect(top).toHaveAttribute("data-source", "local");
  await page.locator(".tiptap section p").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(section).toHaveCSS("padding-top", "10px");
  await page
    .getByRole("button", { name: "Select Section", exact: true })
    .click();
  await expect(top).toHaveValue("10");
  // Displayed defaults remain absent from the node until a commit.
  await expect(section).not.toHaveAttribute("style", /padding-top:\s*0px/);
  await page.getByRole("button", { name: "Unified Padding" }).click();
  await expect(
    page.getByRole("textbox", { name: "Padding", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Individual Padding" }).click();
  await expect(top).toBeVisible();
});

test("typographyCommitsToCurrentBlockAndRetainsOtherProperties", async ({
  page,
}) => {
  await page.goto("/");
  const heading = page.locator(".tiptap h1");
  await heading.click();
  const size = page.getByRole("textbox", { name: "Font size", exact: true });
  await size.fill("28");
  await expect(heading).toHaveCSS("font-size", "31.5px");
  await size.press("Enter");
  await expect(heading).toHaveCSS("font-size", "28px");
  const height = page.getByRole("textbox", {
    name: "Line height",
    exact: true,
  });
  await height.fill("150");
  await height.press("Enter");
  await expect(heading).toHaveCSS("line-height", "42px");
  await expect(heading).toHaveCSS("font-size", "28px");
  await page.getByRole("button", { name: "Align right", exact: true }).click();
  await expect(heading).toHaveCSS("text-align", "right");
  await expect(page.locator(".tiptap p").first()).toHaveCSS(
    "text-align",
    "start",
  );
});

test("sectionWeightPortalRetainsNodeSelection", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tiptap section p").click();
  await page
    .getByRole("button", { name: "Select Section", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Weight", exact: true }).click();
  await page.getByRole("option", { name: "Bold", exact: true }).click();
  await expect(page.locator(".tiptap section")).toHaveCSS("font-weight", "700");
  await expect(
    page.getByRole("heading", { name: "Section", exact: true }),
  ).toBeVisible();
  const top = page.getByRole("textbox", { name: "Padding top", exact: true });
  await top.fill("0");
  await top.press("Enter");
  await expect(page.locator(".tiptap section")).toHaveCSS("font-weight", "700");
  await expect(page.locator(".tiptap section")).toHaveCSS("padding-top", "0px");
});

test("borderSidesRemainIndependent", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Individual Border", exact: true })
    .click();
  const top = page.getByRole("textbox", { name: "Border top", exact: true });
  await top.fill("2");
  await top.press("Enter");
  await expect(page.locator(".node-container")).toHaveCSS(
    "border-top-width",
    "2px",
  );
  await expect(page.locator(".node-container")).toHaveCSS(
    "border-right-width",
    "1px",
  );
  await page
    .getByRole("button", { name: "Individual Corner radius", exact: true })
    .click();
  const corner = page.getByRole("textbox", {
    name: "Corner radius top left",
    exact: true,
  });
  await corner.fill("8");
  await corner.press("Enter");
  await expect(page.locator(".node-container")).toHaveCSS(
    "border-top-left-radius",
    "8px",
  );
  await expect(page.locator(".node-container")).toHaveCSS(
    "border-top-right-radius",
    "0px",
  );
});

test("deepestBreadcrumbSelectsOnlyNestedSection", async ({ page }) => {
  const document = createReferenceDocument();
  const section = document.content![1].content![2];
  section.content = [
    {
      type: "section",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Nested content" }],
        },
      ],
    },
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
  await page.locator(".tiptap section section p").click();
  const breadcrumbs = page.getByRole("button", {
    name: "Select Section",
    exact: true,
  });
  await expect(breadcrumbs).toHaveCount(2);
  await breadcrumbs.last().click();
  await expect(page.locator(".tiptap")).toBeFocused();
  const top = page.getByRole("textbox", { name: "Padding top", exact: true });
  await top.fill("0");
  await top.press("Enter");
  await expect(page.locator(".tiptap section section")).toHaveCSS(
    "padding-top",
    "0px",
  );
  await expect(page.locator(".tiptap section").first()).toHaveCSS(
    "padding-top",
    "10px",
  );
});

test("existingTypographyUnitsAreRetainedOnCommit", async ({ page }) => {
  const document = createReferenceDocument();
  document.content![1].content![1].attrs = {
    level: 1,
    style: "font-size: 150%; line-height: 32px;",
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
  const size = page.getByRole("textbox", { name: "Font size", exact: true });
  await size.fill("160");
  await size.press("Enter");
  await expect(page.locator(".tiptap h1")).toHaveCSS("font-size", "22.4px");
  const height = page.getByRole("textbox", {
    name: "Line height",
    exact: true,
  });
  await height.fill("36");
  await height.press("Enter");
  await expect(page.locator(".tiptap h1")).toHaveCSS("line-height", "36px");
});

test("automaticHeightRemainsDistinctFromInherited", async ({ page }) => {
  const document = createReferenceDocument();
  const styles = document.content![0].attrs!.data.styles;
  styles
    .find((panel: { id: string }) => panel.id === "container")
    .inputs.find((input: { prop: string }) => input.prop === "height").value =
    "";
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
  await expect(
    page.getByRole("textbox", { name: "Height", exact: true }),
  ).toHaveAttribute("data-source", "automatic");
  await expect(
    page.getByRole("textbox", { name: "Height", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Height", exact: true }),
  ).toHaveAttribute("placeholder", "auto");
});

test("individualPaddingNormalizesAllSidesAndPreservesHiddenMargin", async ({
  page,
}) => {
  const document = createReferenceDocument();
  document.content![1].content![1].attrs = {
    level: 1,
    style: "padding-right: 50%; margin-right: 2em;",
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
  const heading = page.locator(".tiptap h1");
  await heading.click();
  const top = page.getByRole("textbox", { name: "Padding top", exact: true });
  await top.fill("1");
  await top.press("Enter");
  await expect
    .poll(() =>
      heading.evaluate((node) => (node as HTMLElement).style.paddingRight),
    )
    .toBe("50px");
  await expect
    .poll(() =>
      heading.evaluate((node) => (node as HTMLElement).style.marginRight),
    )
    .toBe("2em");
  const right = page.getByRole("textbox", {
    name: "Padding right",
    exact: true,
  });
  await right.fill("25");
  await right.press("Enter");
  await expect
    .poll(() =>
      heading.evaluate((node) => (node as HTMLElement).style.paddingRight),
    )
    .toBe("25px");
  await expect(
    page.getByRole("button", { name: "Individual Margin", exact: true }),
  ).toHaveCount(0);
  await expect(heading).toHaveCSS("padding-top", "1px");
});
