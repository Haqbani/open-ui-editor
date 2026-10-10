import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });
test("workspaceUsesMeasuredGeometry", async ({ page }) => {
  await page.goto("/");
  const header = page.getByTestId("editor-topbar");
  await expect(header).toBeVisible();
  expect((await header.boundingBox())?.height).toBe(60);
  const canvas = await page.getByTestId("editor-canvas").boundingBox();
  expect(canvas?.x).toBe(64);
  expect(canvas?.y).toBe(60);
  const inspector = page.getByTestId("editor-inspector");
  expect(await inspector.boundingBox()).toMatchObject({
    x: 944,
    y: 76,
    width: 320,
    height: 588,
  });
  await expect(inspector).toHaveCSS("border-radius", "16px");
  expect(
    await page.getByTestId("insertion-palette").boundingBox(),
  ).toMatchObject({ x: 80, y: 267, width: 50, height: 146 });
  const body = page.locator(".node-container");
  expect(await body.boundingBox()).toMatchObject({ x: 372, width: 600 });
  await expect(
    page.getByRole("button", { name: "Hide sidebar", exact: true }),
  ).toBeEnabled();
  await expect(inspector).toBeVisible();
  expect(await body.boundingBox()).toMatchObject({ x: 372, width: 600 });
});

test("titleEscapeAndOptionalFields", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Neutral template", exact: true })
    .click();
  const beforeTitleRevision = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("open-ui-editor:local-draft:foundation") ??
          '{"revision":0}',
      ).revision,
  );
  const title = page.getByRole("textbox", {
    name: "Template title",
    exact: true,
  });
  await title.fill("Draft title");
  await title.press("Escape");
  await expect(title).toBeFocused();
  await expect(title).toHaveValue("Draft title");
  await title.press("Enter");
  await expect(title).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Draft title", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Reply-To", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Reply-To", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Reply-To", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview text", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("open-ui-editor:local-draft:foundation") ?? "{}",
        ).revision,
    ),
  ).toBeGreaterThan(beforeTitleRevision);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Draft title", exact: true }),
  ).toBeVisible();
});

for (const appearance of ["light", "dark"] as const)
  test(`inspector preserves ${appearance} workspace chrome when handle menu opens`, async ({
    page,
  }) => {
    await page.goto(`/?devAppearance=${appearance}`);
    const inspector = page.getByTestId("editor-inspector");
    const background =
      appearance === "dark" ? "rgb(0, 0, 0)" : "rgb(240, 240, 240)";
    const border =
      appearance === "dark"
        ? "rgba(202, 236, 255, 0.2)"
        : "rgba(0, 0, 0, 0.08)";
    await expect(inspector).toHaveCSS("background-color", background);
    await expect(inspector).toHaveCSS("border-top-color", border);
    await expect(inspector).toHaveCSS("border-top-width", "1px");
    await page.locator(".tiptap h1").hover();
    await page.locator(".block-action-handle").click();
    await expect(page.getByRole("menu").first()).toHaveCSS(
      "background-color",
      appearance === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)",
    );
    await expect(inspector).toHaveCSS("background-color", background);
    await expect(inspector).toHaveCSS("border-top-color", border);
  });
