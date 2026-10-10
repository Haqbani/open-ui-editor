import { expect, test } from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { placeCaretAtFirstParagraphStart } from "../helpers/native-caret";

test("editingSurvivesModeSwitchAndReload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const editable = page.getByTestId("email-editor").locator(".tiptap");
  await expect(editable).toBeVisible();
  await placeCaretAtFirstParagraphStart(editable);
  await page.keyboard.type("Persistent ");
  await expect(editable.locator("p").first()).toHaveText("Persistent Welcome");
  const element = await editable.elementHandle();
  const themeScope = await editable.getAttribute("data-editor-theme-scope");
  // Save the actual DOM object and browser selection, not private React/controller state.
  await editable.evaluate((node) => {
    Reflect.set(window, "__continuity", {
      node,
      anchor: getSelection()?.anchorNode,
      offset: getSelection()?.anchorOffset,
    });
  });
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  await expect(editable).toBeHidden();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  expect(
    await editable.evaluate(
      (node) => node === Reflect.get(window, "__continuity").node,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Editor", exact: true }),
  ).toBeFocused();
  await editable.focus();
  await expect(editable).toBeFocused();
  await expect
    .poll(() =>
      editable.evaluate(() => {
        const before = Reflect.get(window, "__continuity");
        return (
          getSelection()?.anchorNode === before.anchor &&
          getSelection()?.anchorOffset === before.offset
        );
      }),
    )
    .toBe(true);
  await page.keyboard.type("continued ");
  await expect(editable).toContainText("Persistent continued Welcome");
  // At most two undo groups contain the two user typing runs; both pre-mode history and resumed editing survive.
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editable.locator("p").first()).toHaveText("Welcome");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(editable).toContainText("Persistent continued Welcome");
  // Accepted source sidebar controls remain UI-only through the same editor session.
  await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Show sidebar", exact: true }).hover();
  await page.getByRole("button", { name: "Pin sidebar", exact: true }).click();
  await expect(page.getByTestId("editor-inspector")).toBeVisible();
  await expect(editable).toContainText("Persistent continued Welcome");
  await editable.click({ position: { x: 20, y: 15 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Persistent subject");
  await page
    .getByRole("textbox", { name: "From", exact: true })
    .fill("Local <local@example.com>");
  await page.getByRole("button", { name: "Reply-To", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Reply-To", exact: true })
    .fill("reply@example.com");
  await page.getByRole("button", { name: "Preview text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Preview", exact: true })
    .fill("Persistent preview");
  expect(await element?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(editable).toHaveAttribute(
    "data-editor-theme-scope",
    themeScope!,
  );
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await expect(editable).toContainText("Persistent continued Welcome");
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("Persistent subject");
  await expect(
    page.getByRole("textbox", { name: "From", exact: true }),
  ).toHaveValue("Local <local@example.com>");
  await expect(
    page.getByRole("textbox", { name: "Reply-To", exact: true }),
  ).toHaveValue("reply@example.com");
  await expect(
    page.getByRole("textbox", { name: "Preview", exact: true }),
  ).toHaveValue("Persistent preview");
  expect(errors).toEqual([]);
});

test("unavailableStorageRetainsEditableDraft", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Unavailable");
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Unsaved subject");
  await expect(page.getByRole("status")).toHaveText(
    "Local draft could not be loaded",
  );
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("Unsaved subject");
  const editable = page.getByTestId("email-editor").locator(".tiptap");
  await placeCaretAtFirstParagraphStart(editable);
  await page.keyboard.type("Unsaved ");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await expect(editable).toContainText("Unsaved Welcome");
});

test("normal runtime owns one local history session with JSON-only saved reload", async ({
  page,
}) => {
  await page.goto("/");
  const editable = page.getByTestId("email-editor").locator(".tiptap");
  await expect(editable).toBeVisible();
  const inspect = () =>
    editable.evaluate((el) => {
      const editor = (el as HTMLElement & { editor: Editor }).editor;
      const states = editor.state.plugins.map((plugin) =>
        plugin.spec.key?.getState(editor.state),
      );
      return {
        collaboration: editor.extensionManager.extensions.filter(
          (extension) => extension.name === "collaboration",
        ).length,
        pmHistory: states.filter((state) => state?.done && state?.undone)
          .length,
        sync: states.filter((state) => state?.doc && state?.type).length,
        undo: states.filter((state) => state?.undoManager).length,
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        json: editor.getJSON(),
      };
    });
  const initial = await inspect();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(initial).toMatchObject({
    collaboration: 1,
    pmHistory: 0,
    sync: 1,
    undo: 1,
    canUndo: false,
    canRedo: false,
  });
  await placeCaretAtFirstParagraphStart(editable);
  await page.keyboard.type("JSON persistence ");
  const edited = (await inspect()).json;
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const stored = await page.evaluate(() => Object.entries(localStorage));
  await page.reload();
  await expect(editable).toContainText("JSON persistence Welcome");
  expect(await inspect()).toEqual({ ...initial, json: edited });
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual(
    stored,
  );
});
