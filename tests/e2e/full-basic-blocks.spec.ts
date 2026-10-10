import { expect, type Page, test } from "@playwright/test";
import { createDocumentContract } from "../../src/editor/document-contract";
import { createReferenceDocument } from "../../src/editor/reference-document";
import { createEditorExtensions } from "../helpers/extensions";

async function saved(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("open-ui-editor:local-draft:foundation")!)
        .document,
  );
}
test.beforeEach(async ({ page }) => {
  const document = createReferenceDocument();
  document.content![1].content = [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Neutral title" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Neutral body" }] },
  ];
  await page.addInitScript((document) => {
    if (!localStorage.getItem("open-ui-editor:local-draft:foundation"))
      localStorage.setItem(
        "open-ui-editor:local-draft:foundation",
        JSON.stringify({
          id: "foundation",
          title: "Neutral",
          revision: 0,
          metadata: { from: "", replyTo: "", subject: "", previewText: "" },
          document,
        }),
      );
  }, createDocumentContract(createEditorExtensions())
    .schema.nodeFromJSON(document)
    .toJSON());
  await page.goto("/");
  await page.locator(".tiptap h1").click();
});
for (const [label, selector, group] of [
  ["Bullet list", "ul li p", "Text"],
  ["Numbered list", "ol li p", "Text"],
  ["Code", "pre code", "Components"],
]) {
  test(`${label} converts title and undo restores document and focus`, async ({
    page,
  }) => {
    const before = await saved(page);
    await page
      .getByTestId("insertion-palette")
      .getByRole("button", { name: group, exact: true })
      .click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator(`.tiptap ${selector}`)).toHaveText(
      "Neutral title",
    );
    await expect(page.locator(".tiptap h1")).toHaveCount(0);
    await expect(page.locator(".tiptap")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".tiptap h1")).toHaveText("Neutral title");
    expect(await saved(page)).toEqual(before);
    await expect(page.locator(".tiptap")).toBeFocused();
  });
}
test("Quote wraps and retains title", async ({ page }) => {
  const before = await saved(page);
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await expect(page.locator(".tiptap blockquote h1")).toHaveText(
    "Neutral title",
  );
  await page.keyboard.press("ControlOrMeta+z");
  expect(await saved(page)).toEqual(before);
  await expect(page.locator(".tiptap")).toBeFocused();
});
test("Button inserts after title with editable label and href", async ({
  page,
}) => {
  const before = await saved(page);
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Button", exact: true }).click();
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).toHaveText("Button");
  const doc = await saved(page);
  expect(doc.content[1].content[1]).toMatchObject({
    type: "button",
    attrs: { href: "#" },
    content: [{ type: "text", text: "Button" }],
  });
  await page.keyboard.press("ControlOrMeta+z");
  expect(await saved(page)).toEqual(before);
});
test("Divider selected atom preserves native Undo guard and Backspace restores document", async ({
  page,
}) => {
  const before = await saved(page);
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Divider", exact: true }).click();
  await expect(page.locator(".tiptap hr")).toHaveCount(1);
  await expect(
    page
      .getByTestId("editor-inspector")
      .getByRole("heading", { name: "Body", exact: true }),
  ).toBeVisible();
  const inserted = await saved(page);
  await page.locator(".tiptap hr").click();
  await expect(
    page
      .getByTestId("editor-inspector")
      .getByRole("heading", { name: "Divider", exact: true }),
  ).toBeVisible();
  await page.locator(".tiptap").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap hr")).toHaveCount(1);
  expect(await saved(page)).toEqual(inserted);
  await page.keyboard.press("Backspace");
  await expect(page.locator(".tiptap hr")).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
});

test("Code theme edit persists and exported code retains text and theme", async ({
  page,
}) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Code", exact: true }).click();
  const sidebar = page.getByTestId("editor-inspector");
  await sidebar.getByRole("combobox", { name: "Code theme" }).click();
  await page.getByRole("option", { name: "Dracula", exact: true }).click();
  await expect(page.locator(".tiptap pre")).toHaveAttribute(
    "data-theme",
    "dracula",
  );
  await expect
    .poll(async () => (await saved(page)).content[1].content[0].attrs.theme)
    .toBe("dracula");
  await page.reload();
  await expect(page.locator(".tiptap pre")).toHaveAttribute(
    "data-theme",
    "dracula",
  );
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator(".cm-content").first()).toContainText(
    'data-theme="dracula"',
  );
  await expect(page.locator(".cm-content").first()).toContainText("Neutral");
  await expect(page.locator(".cm-content").first()).toContainText("title");
});

test("list ancestor edits preserve captured generic styles through reload and export", async ({
  page,
}) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Numbered list", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select Ordered List", exact: true })
    .click();
  const sidebar = page.getByTestId("editor-inspector");
  await sidebar.getByRole("textbox", { name: "Start", exact: true }).fill("3");
  await sidebar
    .getByRole("textbox", { name: "Start", exact: true })
    .press("Enter");
  await sidebar.getByRole("textbox", { name: "Type", exact: true }).fill("a");
  await sidebar
    .getByRole("textbox", { name: "Type", exact: true })
    .press("Enter");
  await sidebar
    .getByRole("button", { name: "Align center", exact: true })
    .click();
  await sidebar
    .getByRole("textbox", { name: "Padding bottom", exact: true })
    .fill("20");
  await sidebar
    .getByRole("textbox", { name: "Padding bottom", exact: true })
    .press("Enter");
  const list = (await saved(page)).content[1].content[0];
  expect(list.attrs).toMatchObject({
    start: 1,
    type: null,
    tight: true,
    alignment: "center",
  });
  expect(list.attrs.style).toContain("start:3");
  expect(list.attrs.style).toContain("type:a");
  await page.reload();
  await expect(page.locator(".tiptap ol li p")).toHaveText("Neutral title");
  await page.getByRole("button", { name: "Code", exact: true }).click();
  const output = await page
    .locator('iframe[title="Email preview"]')
    .getAttribute("srcdoc");
  expect(output).toMatch(/<ol[^>]*start="1"/);
  expect(output).toMatch(/<ol[^>]*start:3;type:a/);
  expect(output).not.toMatch(/<ol[^>]*text-align:center/);
});

test("Quote toggle unwraps while retaining heading and strong", async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = "open-ui-editor:local-draft:foundation";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.document.content[1].content[0].content = [
      { type: "text", text: "Bold", marks: [{ type: "bold" }] },
    ];
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await page.locator(".tiptap h1").click();
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await expect(page.locator(".tiptap blockquote h1 strong")).toHaveText("Bold");
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await expect(page.locator(".tiptap blockquote")).toHaveCount(0);
  await expect(page.locator(".tiptap h1 strong")).toHaveText("Bold");
});

test("Turn into Quote converts title to paragraph unlike direct quote toggle", async ({
  page,
}) => {
  await page.locator(".tiptap h1").hover();
  await page
    .getByRole("button", { name: "Block actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Turn into", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Quote", exact: true }).click();
  await expect(page.locator(".tiptap blockquote p")).toHaveText(
    "Neutral title",
  );
  await expect(page.locator(".tiptap h1")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap h1")).toHaveText("Neutral title");
});

test("basic family nodes receive inherited theme styles without inline defaults", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await expect(page.locator(".tiptap blockquote")).toHaveCSS(
    "border-left-width",
    "3px",
  );
  await expect(page.locator(".tiptap blockquote")).toHaveCSS(
    "padding-left",
    "12.32px",
  );
  expect((await saved(page)).content[1].content[0].attrs.style).toBe("");
  await page.keyboard.press("ControlOrMeta+z");
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Bullet list", exact: true })
    .click();
  await expect(page.locator(".tiptap ul")).toHaveCSS("list-style-type", "disc");
  await expect(page.locator(".tiptap ul")).toHaveCSS("padding-left", "15.4px");
});

test("Button link apply, size edit, reload and export use actual button attrs", async ({
  page,
}) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Button", exact: true }).click();
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Paste a link", exact: true })
    .fill("https://example.com/replica");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).toHaveAttribute("data-href", "https://example.com/replica");
  await page.getByRole("button", { name: "Add Size", exact: true }).click();
  const sidebar = page.getByTestId("editor-inspector");
  await sidebar
    .getByRole("textbox", { name: "Width", exact: true })
    .fill("240");
  await sidebar
    .getByRole("textbox", { name: "Width", exact: true })
    .press("Enter");
  await sidebar
    .getByRole("textbox", { name: "Height", exact: true })
    .filter({ visible: true })
    .and(sidebar.getByPlaceholder("auto"))
    .fill("48");
  await sidebar
    .getByRole("textbox", { name: "Height", exact: true })
    .and(sidebar.getByPlaceholder("auto"))
    .press("Enter");
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).toHaveCSS("width", "240px");
  await page.getByRole("button", { name: "Remove Size", exact: true }).click();
  await expect(
    sidebar.getByRole("button", { name: "Add Size", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).not.toHaveCSS("width", "240px");
  await page.reload();
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).not.toHaveCSS("height", "48px");
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Email preview"]')
      .getByRole("link", { name: "Button", exact: true }),
  ).toHaveAttribute("href", "https://example.com/replica");
});

test("Title to Body retains the captured inline color", async ({ page }) => {
  await page.evaluate(() => {
    const key = "open-ui-editor:local-draft:foundation";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.document.content[1].content[0].attrs.style = "color: #123456;";
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await page.locator(".tiptap h1").click();
  await page
    .getByRole("button", { name: "Change text type", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Body", exact: true }).click();
  await expect(page.locator(".tiptap p").first()).toHaveCSS(
    "color",
    "rgb(18, 52, 86)",
  );
  expect((await saved(page)).content[1].content[0].attrs.style).toBe(
    "color: #123456;",
  );
});

test("Quote inspector displays observed inherited padding without persisting it", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await page
    .getByRole("button", { name: "Select Blockquote", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Padding left", exact: true }),
  ).toHaveValue("13");
  expect((await saved(page)).content[1].content[0].attrs.style).toBe("");
});

test("Quote spacing edit persists and exports", async ({ page }) => {
  await page.getByRole("button", { name: "Blockquote", exact: true }).click();
  await page
    .getByRole("button", { name: "Select Blockquote", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Padding left", exact: true })
    .fill("20");
  await page
    .getByRole("textbox", { name: "Padding left", exact: true })
    .press("Enter");
  await expect(page.locator(".tiptap blockquote")).toHaveCSS(
    "padding-left",
    "20px",
  );
  await page.reload();
  await expect(page.locator(".tiptap blockquote")).toHaveCSS(
    "padding-left",
    "20px",
  );
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Email preview"]').locator("blockquote"),
  ).toHaveCSS("padding-left", "20px");
});

test("Divider spacing entry matches source transient feedback and unchanged document", async ({
  page,
}) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Divider", exact: true }).click();
  await page.locator(".tiptap hr").click();
  const before = await saved(page);
  const bottom = page.getByRole("textbox", {
    name: "Padding bottom",
    exact: true,
  });
  await bottom.fill("24");
  await bottom.press("Enter");
  await expect(bottom).toHaveValue("24");
  await expect(page.locator(".tiptap hr")).toHaveCSS("padding-bottom", "14px");
  expect(await saved(page)).toEqual(before);
  await page.locator(".tiptap h1").click();
  await page.locator(".tiptap hr").click();
  await expect(bottom).toHaveValue("16");
  await page.reload();
  await expect(page.locator(".tiptap hr")).toHaveCSS("padding-bottom", "14px");
  await page.getByRole("button", { name: "Code", exact: true }).click();
  expect(
    await page.locator('iframe[title="Email preview"]').getAttribute("srcdoc"),
  ).toMatch(/<hr[^>]*padding-bottom:1em/);
});

test("existing Button link popup stays a Remove action while editing its draft", async ({
  page,
}) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components" })
    .click();
  await page.getByRole("menuitem", { name: "Button", exact: true }).click();
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Paste a link", exact: true })
    .fill("https://example.com/replica");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Paste a link", exact: true }),
  ).toHaveValue("https://example.com/replica");
  await page
    .getByRole("textbox", { name: "Paste a link", exact: true })
    .fill("invalid destination");
  await page.getByRole("button", { name: "Remove link", exact: true }).click();
  await expect(
    page.locator('.tiptap [data-id="react-email-button"]'),
  ).toHaveAttribute("data-href", "");
});

test("list drafts follow selected target and undo without leaking values", async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = "open-ui-editor:local-draft:foundation";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.document.content[1].content = [1, 3].map((start) => ({
      type: "orderedList",
      attrs: { start, style: "start:4" },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `List ${start}` }],
            },
          ],
        },
      ],
    }));
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  const sidebar = page.getByTestId("editor-inspector");
  for (const start of [1, 3]) {
    await page
      .locator(".tiptap li p")
      .filter({ hasText: `List ${start}` })
      .click();
    await page
      .getByRole("button", { name: "Select Ordered List", exact: true })
      .click();
    await expect(
      sidebar.getByRole("textbox", { name: "Start", exact: true }).first(),
    ).toHaveValue(String(start));
  }
  const style = sidebar
    .getByRole("textbox", { name: "Start", exact: true })
    .last();
  await style.fill("7");
  await style.press("Enter");
  await expect(style).toHaveValue("7");
  await page.locator(".tiptap").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    sidebar.getByRole("heading", { name: "Ordered List", exact: true }),
  ).toBeVisible();
  await expect(style).toHaveValue("4");
});

test("button size group belongs to the selected button", async ({ page }) => {
  await page.evaluate(() => {
    const key = "open-ui-editor:local-draft:foundation";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.document.content[1].content = ["width:240px", ""].map((style, i) => ({
      type: "button",
      attrs: { style, href: "#" },
      content: [{ type: "text", text: `Button ${i}` }],
    }));
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  const sidebar = page.getByTestId("editor-inspector");
  await page.locator(".tiptap [data-id=react-email-button]").first().click();
  await expect(
    sidebar.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("240");
  await page.locator(".tiptap [data-id=react-email-button]").last().click();
  await expect(
    sidebar.getByRole("button", { name: "Add Size", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveCount(0);
});

for (const label of ["Button", "Code", "Quote"]) {
  test(`${label} inherits observed border values without persisting defaults`, async ({
    page,
  }) => {
    const before = await saved(page);
    if (label === "Quote")
      await page
        .getByRole("button", { name: "Blockquote", exact: true })
        .click();
    else {
      await page
        .getByTestId("insertion-palette")
        .getByRole("button", { name: "Components", exact: true })
        .click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
    }
    if (label === "Quote")
      await page
        .getByRole("button", { name: "Select Blockquote", exact: true })
        .click();
    const sidebar = page.getByTestId("editor-inspector");
    const field = label === "Quote" ? "Border left" : "Corner radius";
    if (label === "Quote")
      await sidebar
        .getByRole("button", { name: "Individual Border", exact: true })
        .click();
    const inherited = sidebar.getByRole("textbox", {
      name: field,
      exact: true,
    });
    if (label === "Quote") await expect(inherited).toHaveValue("3");
    else await expect(inherited).toHaveAttribute("placeholder", "4");
    const doc = await saved(page);
    const node = doc.content[1].content[label === "Button" ? 1 : 0];
    expect(node.attrs.style ?? "").toBe("");
    expect(before.content[1].content[0].attrs.style ?? "").toBe("");
  });
}

for (const choice of ["Bullet list", "Code", "Turn into Quote"]) {
  test(`rich padded title supports ${choice} with source style semantics`, async ({
    page,
  }) => {
    await page.evaluate(() => {
      const key = "open-ui-editor:local-draft:foundation";
      const draft = JSON.parse(localStorage.getItem(key)!);
      const heading = draft.document.content[1].content[0];
      heading.attrs.style = "padding:12px 0px 0px";
      heading.content[0].marks = [
        { type: "italic" },
        { type: "preservedStyle", attrs: { style: "color:#123456" } },
      ];
      localStorage.setItem(key, JSON.stringify(draft));
    });
    await page.reload();
    await page.locator(".tiptap h1").click();
    if (choice === "Turn into Quote") {
      await page.locator(".tiptap h1").hover();
      await page
        .getByRole("button", { name: "Block actions", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Turn into", exact: true })
        .hover();
      await page.getByRole("menuitem", { name: "Quote", exact: true }).click();
    } else {
      await page
        .getByTestId("insertion-palette")
        .getByRole("button", {
          name: choice === "Code" ? "Components" : "Text",
          exact: true,
        })
        .click();
      await page.getByRole("menuitem", { name: choice, exact: true }).click();
    }
    const selector =
      choice === "Code"
        ? "pre"
        : choice === "Bullet list"
          ? "ul p"
          : "blockquote p";
    await expect(page.locator(`.tiptap ${selector}`)).toHaveText(
      "Neutral title",
    );
    if (choice === "Code") {
      await expect(page.locator(".tiptap pre")).toHaveCSS(
        "padding-top",
        "12px",
      );
      await expect(page.locator(".tiptap pre em")).toHaveCount(0);
    } else {
      await expect(page.locator(`.tiptap ${selector}`)).not.toHaveAttribute(
        "style",
        /padding/,
      );
      await expect(page.locator(`.tiptap ${selector} em`)).toHaveText(
        "Neutral title",
      );
      await expect(
        page.locator(`.tiptap ${selector} span[style*="color"]`),
      ).toHaveCSS("color", "rgb(18, 52, 86)");
    }
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".tiptap h1 em")).toHaveText("Neutral title");
    await expect(page.locator(".tiptap h1")).toHaveCSS("padding-top", "12px");
  });
}

for (const [label, tag] of [
  ["Text", "p"],
  ["Title", "h1"],
  ["Subtitle", "h2"],
  ["Heading", "h3"],
]) {
  test(`palette ${label} inserts sibling and preserves rich source heading`, async ({
    page,
  }) => {
    await page.evaluate(() => {
      const key = "open-ui-editor:local-draft:foundation";
      const draft = JSON.parse(localStorage.getItem(key)!);
      const h = draft.document.content[1].content[0];
      h.attrs.style = "padding-top:12px";
      h.content[0].marks = [{ type: "italic" }];
      localStorage.setItem(key, JSON.stringify(draft));
    });
    await page.reload();
    await page.locator(".tiptap h1").click();
    const before = await saved(page);
    await page
      .getByTestId("insertion-palette")
      .getByRole("button", { name: "Text", exact: true })
      .click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(
      page.locator(`.tiptap ${tag}`).filter({ hasText: /^$/ }).first(),
    ).toBeVisible();
    const after = await saved(page);
    expect(after.content[1].content[0]).toEqual(before.content[1].content[0]);
    expect(after.content[1].content[1].type).toBe(
      tag === "p" ? "paragraph" : "heading",
    );
    expect(after.content[1].content[1].content ?? []).toEqual([]);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => saved(page)).toEqual(before);
  });
}

for (const source of ["Button", "Code"]) {
  test(`${source} palette converts to list and undo restores original node`, async ({
    page,
  }) => {
    await page
      .getByTestId("insertion-palette")
      .getByRole("button", { name: "Components", exact: true })
      .click();
    await page.getByRole("menuitem", { name: source, exact: true }).click();
    const before = await saved(page);
    await page.keyboard.press("Escape");
    await page
      .getByTestId("insertion-palette")
      .getByRole("button", { name: "Text", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Bullet list", exact: true })
      .click();
    await expect(page.locator(".tiptap ul li p")).toHaveText(
      source === "Button" ? "Button" : "Neutral title",
    );
    await expect(
      page.locator(
        source === "Button"
          ? '.tiptap [data-id="react-email-button"]'
          : ".tiptap pre",
      ),
    ).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => saved(page)).toEqual(before);
  });
}

test("Code actions omit Turn into", async ({ page }) => {
  await page
    .getByTestId("insertion-palette")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Code", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator(".tiptap pre").hover();
  await page
    .getByRole("button", { name: "Block actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: /^Duplicate/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Turn into", exact: true }),
  ).toHaveCount(0);
});

test("Button palette converts to Code retaining shared alignment", async ({
  page,
}) => {
  const palette = page.getByTestId("insertion-palette");
  await palette
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Button", exact: true }).click();
  const before = await saved(page);
  await page.getByRole("menuitem", { name: "Code", exact: true }).click();
  await expect(page.locator(".tiptap pre code")).toHaveText("Button");
  const code = (await saved(page)).content[1].content[1];
  expect(code.attrs).toMatchObject({
    alignment: "left",
    language: "javascript",
    theme: "default",
  });
  expect(code.attrs.href).toBeUndefined();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => saved(page)).toEqual(before);
});
