import { expect, test } from "@playwright/test";

test("Table insertion and column menu mutate rectangular structure", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".tiptap h1").click();
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Table", exact: true }).click();
  await expect(page.locator('[data-type="data-table-cell"]')).toHaveCount(9);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Column options 1", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Insert right", exact: true })
    .click();
  await expect(page.locator('[data-type="data-table-cell"]')).toHaveCount(12);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator('[data-type="data-table-cell"]')).toHaveCount(9);
});
for (const n of [2, 3, 4])
  test(`${n} columns palette inserts siblings`, async ({ page }) => {
    await page.goto("/");
    await page.locator(".tiptap h1").click();
    await page
      .getByTestId("insertion-palette")
      .getByRole("button", { name: "Components", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: `${n} columns`, exact: true })
      .click();
    await expect(page.locator('[data-type="column"]')).toHaveCount(n);
  });
test("table parent controls preserve editor/export header precedence and theme colors", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".tiptap h1").click();
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Table", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator('[data-type="data-table-cell"] p').first().click();
  await page.getByRole("button", { name: "Select Table", exact: true }).click();
  const inspector = page.getByTestId("editor-inspector");
  expect(
    await inspector
      .getByRole("switch", { name: "Header row", exact: true })
      .evaluate((el) => el.tagName),
  ).toBe("BUTTON");
  await inspector
    .getByRole("switch", { name: "Header row", exact: true })
    .uncheck();
  await inspector
    .getByRole("switch", { name: "Header column", exact: true })
    .check();
  await inspector
    .getByRole("switch", { name: "Striped rows", exact: true })
    .check();
  await inspector.getByRole("button", { name: "Rows", exact: true }).click();
  await expect(page.locator('[data-type="data-table"]')).toHaveAttribute(
    "data-borders",
    "horizontal",
  );
  await expect(
    inspector.getByRole("textbox", { name: "Header background", exact: true }),
  ).toHaveValue("");
  await inspector
    .getByLabel("Header background", { exact: true })
    .fill("#aabbcc");
  await inspector
    .getByRole("textbox", { name: "Header background", exact: true })
    .press("Enter");
  await expect(
    page.locator('[data-type="data-table-row"]').nth(1).locator("td").first(),
  ).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  const preview = page.frameLocator('iframe[title="Email preview"]');
  await expect(preview.locator('th[scope="row"]')).toHaveCount(3);
  await expect(preview.locator('th[scope="row"]').nth(1)).toHaveCSS(
    "background-color",
    "rgb(170, 187, 204)",
  );
});
test("column child routing and dimensions preserve raw parent cellspacing", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".tiptap h1").click();
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "2 columns", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator('[data-type="column"] p').first().click();
  await expect(
    page
      .getByTestId("editor-inspector")
      .getByRole("heading", { name: "Column", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select 2 Columns", exact: true })
    .click();
  await page.getByLabel("Cellspacing", { exact: true }).fill("8");
  await page.getByLabel("Cellspacing", { exact: true }).press("Enter");
  await page.locator('[data-type="column"] p').first().click();
  await page.getByLabel("Width", { exact: true }).fill("240");
  await page.getByLabel("Width", { exact: true }).press("Enter");
  await expect(page.locator('[data-type="column"]').first()).toHaveCSS(
    "width",
    "240px",
  );
  await page.getByRole("button", { name: "Clear Width", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('[data-type="column"]')
        .first()
        .evaluate((node) => (node as HTMLElement).style.flex),
    )
    .toBe("");
});
test("Tab appends a row and Shift-Tab reverses within the real custom table", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".tiptap h1").click();
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Table", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator('[data-type="data-table-cell"] p').last().click();
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-type="data-table-row"]')).toHaveCount(4);
  await page.keyboard.type("New row");
  await expect(
    page.locator('[data-type="data-table-row"]').last(),
  ).toContainText("New row");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("Previous");
  await expect(
    page.locator('[data-type="data-table-row"]').nth(2).locator("td").last(),
  ).toHaveText("Previous");
});
