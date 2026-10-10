import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { placeCaretAtFirstParagraphStart } from "../helpers/native-caret";

test.use({ viewport: { width: 1280, height: 720 } });
const key = "open-ui-editor:local-draft:foundation";
for (const rejection of ["malformed", "schema"] as const) {
  test(`rejectedDraftSurvivesFallbackEditsAndRawRecovery:${rejection}`, async ({
    page,
  }) => {
    const document = createReferenceDocument();
    document.content![1].content!.push({
      type: "unrecognizedSavedBlock",
      attrs: { text: "UNRECOVERED SAVED CONTENT" },
    });
    const raw =
      rejection === "malformed"
        ? '{ "id": "foundation", "revision": "bad" }\n'
        : JSON.stringify(
            {
              id: "foundation",
              title: "Rejected",
              revision: 2,
              metadata: { from: "", replyTo: "", subject: "", previewText: "" },
              document,
            },
            null,
            2,
          );
    await page.goto("/");
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key,
      raw,
    });
    await page.reload();
    const body = page.locator(".tiptap");
    await placeCaretAtFirstParagraphStart(body);
    await page.keyboard.type("Fallback edits ");
    const subject = page.getByRole("textbox", { name: "Subject", exact: true });
    for (let i = 0; i < 4; i++) await subject.fill(`Unsaved ${i}`);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      raw,
    );
    await expect(page.getByRole("status")).toContainText(
      "Local draft could not be loaded",
    );
    await expect(page.getByRole("status")).not.toHaveText("Saved locally");
    await page.getByText("Draft recovery", { exact: true }).click();
    await expect(
      page.getByTestId("editor-topbar").getByRole("alert"),
    ).toContainText("Changes in this session are not saved");
    const downloading = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download saved raw draft" }).click();
    const download = await downloading;
    expect(await readFile((await download.path())!, "utf8")).toBe(raw);
    await expect(body).toContainText("Fallback edits Welcome");
  });
}

test("sidebarHideKeepsEditorHistoryAndControlsAccessible", async ({ page }) => {
  await page.goto("/");
  const body = page.locator(".tiptap");
  await placeCaretAtFirstParagraphStart(body);
  await page.keyboard.type("Sidebar ");
  const handle = await body.elementHandle();
  const hide = page.getByRole("button", { name: "Hide sidebar", exact: true });
  await expect(hide).toBeEnabled();
  await hide.click();
  await expect
    .poll(
      async () => (await page.getByTestId("editor-inspector").boundingBox())!.x,
    )
    .toBeGreaterThanOrEqual(1279);
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  await expect(page.locator(".code-pane-source .cm-content")).toContainText(
    "Sidebar Welcome",
  );
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  expect(
    await handle!.evaluate(
      (node) => node === document.querySelector(".tiptap"),
    ),
  ).toBe(true);
  await body.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(body.locator("p").first()).toHaveText("Welcome");
  await body.locator("h1").click();
  await expect(
    page.getByRole("textbox", { name: "Font size", exact: true }),
  ).toBeVisible();
});

test("clearingPageStylesAllowsImmediateInsertionAndExport", async ({
  page,
}) => {
  await page.goto("/");
  for (const label of ["Width", "Text"]) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    await field.fill("");
    await field.press("Enter");
  }
  const undefinedPaths = await page.locator(".tiptap").evaluate((node) => {
    const editor = (
      node as HTMLElement & { editor: import("@tiptap/core").Editor }
    ).editor;
    const paths: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (value && typeof value === "object")
        for (const [key, item] of Object.entries(value)) {
          if (item === undefined) paths.push(`${path}.${key}`);
          else walk(item, `${path}.${key}`);
        }
    };
    walk(editor.getJSON(), "$");
    return paths;
  });
  expect(undefinedPaths).toEqual([]);
  await page.locator(".tiptap section p").click();
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Title", exact: true }).click();
  await page.keyboard.type("After clear");
  await expect(page.locator(".tiptap section h1")).toHaveText("After clear");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: "Code", exact: true })
    .click();
  await expect(page.locator(".code-pane-source .cm-content")).toContainText(
    "After clear",
  );
  await expect(
    page.frameLocator('iframe[title="Email preview"]').locator("h1").last(),
  ).toHaveText("After clear");
});

for (const target of ["text", "section", "page"] as const) {
  test(`continuousColorGestureIsOneUndoAfterTextEdit:${target}`, async ({
    page,
  }) => {
    await page.goto("/");
    const body = page.locator(".tiptap");
    await placeCaretAtFirstParagraphStart(body);
    await page.keyboard.type("Prior ");
    if (target === "text") await body.locator("h1").click();
    if (target === "section") {
      await body.locator("section p").click();
      await page
        .getByRole("button", { name: "Select Section", exact: true })
        .click();
    }
    if (target === "page")
      await page
        .getByRole("button", { name: "Page style", exact: true })
        .click();
    const label = target === "page" ? "Text" : "Color";
    const field = page
      .getByRole("textbox", { name: label, exact: true })
      .first();
    await field.fill("#336699");
    await field.press("Enter");
    const before = await body.evaluate((node) =>
      JSON.stringify(
        (
          node as HTMLElement & { editor: import("@tiptap/core").Editor }
        ).editor.getJSON(),
      ),
    );
    await page
      .getByRole("button", { name: `Choose ${label}`, exact: true })
      .first()
      .click();
    const track = await page
      .getByRole("slider", { name: "Hue", exact: true })
      .boundingBox();
    const y = track!.y + track!.height / 2;
    await page.mouse.move(track!.x + track!.width * 0.58, y);
    await page.mouse.down();
    const samples = new Set<string>();
    for (const fraction of [0.63, 0.69, 0.75, 0.81, 0.87, 0.92]) {
      await page.mouse.move(track!.x + track!.width * fraction, y);
      samples.add(await field.inputValue());
    }
    // A held gesture remains one edit even across the history plugin's ordinary typing delay.
    await page.waitForTimeout(600);
    await page.mouse.move(track!.x + track!.width * 0.95, y);
    const final = await field.inputValue();
    const after = await body.evaluate((node) =>
      JSON.stringify(
        (
          node as HTMLElement & { editor: import("@tiptap/core").Editor }
        ).editor.getJSON(),
      ),
    );
    // Release outside the picker without changing the hue's horizontal value.
    await page.mouse.move(track!.x + track!.width * 0.95, y + 180);
    await page.mouse.up();
    expect(samples.size).toBeGreaterThan(3);
    expect(final).not.toBe("#336699");
    await page.keyboard.press("Escape");
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    if (target === "page")
      await page
        .getByRole("button", { name: "Page style", exact: true })
        .click();
    await expect(field).toHaveValue("#336699");
    expect(
      await body.evaluate((node) =>
        JSON.stringify(
          (
            node as HTMLElement & { editor: import("@tiptap/core").Editor }
          ).editor.getJSON(),
        ),
      ),
    ).toBe(before);
    await body.focus();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    if (target === "page")
      await page
        .getByRole("button", { name: "Page style", exact: true })
        .click();
    await expect(field).toHaveValue(final);
    expect(
      await body.evaluate((node) =>
        JSON.stringify(
          (
            node as HTMLElement & { editor: import("@tiptap/core").Editor }
          ).editor.getJSON(),
        ),
      ),
    ).toBe(after);
    await page
      .getByRole("button", { name: `Choose ${label}`, exact: true })
      .first()
      .click();
    const nextTrack = (await page
      .getByRole("slider", { name: "Hue", exact: true })
      .boundingBox())!;
    await page.mouse.move(
      nextTrack.x + nextTrack.width * 0.2,
      nextTrack.y + nextTrack.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      nextTrack.x + nextTrack.width * 0.35,
      nextTrack.y + nextTrack.height / 2,
      { steps: 4 },
    );
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    if (target === "page")
      await page
        .getByRole("button", { name: "Page style", exact: true })
        .click();
    await expect(field).toHaveValue(final);
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(body.locator("p").first()).toHaveText("Prior Welcome");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(body.locator("p").first()).toHaveText("Welcome");
  });
}

for (const ending of ["pointerup", "pointercancel", "unmount"] as const) {
  test(`colorGestureReleasesBeforeDiscreteActions:${ending}`, async ({
    page,
  }) => {
    await page.goto("/");
    const body = page.locator(".tiptap");
    await body.locator("h1").click();
    const color = page
      .getByRole("textbox", { name: "Color", exact: true })
      .first();
    await color.fill("#336699");
    await color.press("Enter");
    await page
      .getByRole("button", { name: "Choose Color", exact: true })
      .first()
      .click();
    const hue = page.getByRole("slider", { name: "Hue", exact: true });
    const track = (await hue.boundingBox())!;
    await page.mouse.move(
      track.x + track.width * 0.6,
      track.y + track.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      track.x + track.width * 0.8,
      track.y + track.height / 2,
      { steps: 6 },
    );
    const dragged = await color.inputValue();
    if (ending === "pointercancel")
      await hue.dispatchEvent("pointercancel", { pointerId: 1, bubbles: true });
    if (ending === "unmount") {
      // Public editor focus causes the inspector branch to unmount mid-gesture.
      await body.locator("section p").focus();
      await page
        .getByRole("button", { name: "Page style", exact: true })
        .evaluate((node) => (node as HTMLButtonElement).click());
      await expect(
        page.getByRole("textbox", { name: "Width", exact: true }),
      ).toBeVisible();
    }
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await body.locator("h1").click();
    await color.fill("#112233");
    await color.press("Enter");
    await page
      .getByRole("button", { name: "Choose Color", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Use #ffffff", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await body.locator("h1").click();
    await expect(color).toHaveValue("#112233");
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await body.locator("h1").click();
    await expect(color).toHaveValue(dragged);
    await body.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await body.locator("h1").click();
    await expect(color).toHaveValue("#336699");
  });
}
