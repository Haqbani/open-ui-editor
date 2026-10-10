# Open UI Editor

An open-source visual email editor built with React and TypeScript. Compose content with editable blocks, configure styles in a contextual inspector, and preview the generated email HTML.

## Features

- Rich text, headings, lists, quotes, buttons, dividers, and code blocks.
- Sections, multi-column layouts, tables, social links, and an unsubscribe footer.
- Image uploads and YouTube thumbnail blocks.
- Drag-and-drop block insertion and rearrangement, with contextual block actions.
- Typography, spacing, colors, borders, alignment, themes, and global CSS controls.
- Browser-local drafts, Undo/Redo, generated HTML, and an isolated email preview.
- Light and dark editor appearances.

## Getting started

Use Node.js 26.5.0 and pnpm 12.8.1, as pinned in this repository.

```sh
git clone https://github.com/Haqbani/open-ui-editor.git
cd open-ui-editor
npx --yes pnpm@12.8.1 install --frozen-lockfile
npx --yes pnpm@12.8.1 dev
```

Open [localhost:3000](http://127.0.0.1:3000).

For dark mode, open [localhost:3000/?devAppearance=dark](http://127.0.0.1:3000/?devAppearance=dark). The editor controls follow the selected appearance; the email canvas uses the document's background color.

No API keys are required. Drafts are stored in your browser. Uploaded images are stored in `.local-assets/` on the local server, so that directory needs to be writable.

## Production build

```sh
NODE_OPTIONS=--no-experimental-webstorage npx --yes pnpm@12.8.1 build
npx --yes pnpm@12.8.1 start
```

The build flag disables Node's experimental server-side Web Storage. Browser draft storage remains available.

## Development

```sh
npx --yes pnpm@12.8.1 typecheck
npx --yes pnpm@12.8.1 lint
npx --yes pnpm@12.8.1 test:unit
npx --yes pnpm@12.8.1 exec playwright install chromium
npx --yes pnpm@12.8.1 test:e2e
```

The code is organized around one Tiptap editor instance:

| Directory | Purpose |
| --- | --- |
| `src/editor/blocks/` | Document blocks, node views, and block commands |
| `src/editor/controls/` | Reusable inspector controls, including the color picker |
| `src/editor/inspector/` | Contextual styling and block configuration |
| `src/editor/export/` | Email HTML generation and preview |
| `src/editor/storage/` | Browser draft persistence |
| `src/editor/services/` | Media and local asset services |
| `src/app/api/` | Local image upload and asset routes |
| `tests/` | Unit tests and browser interaction tests |

The UI uses Base UI, Tailwind CSS, react-colorful, and CodeMirror. Tiptap and React Email provide the document and email-rendering foundations.

## Project status

This is an early release intended for local use and further development. Cloud accounts, shared editing, email delivery, publishing, version history, variables, charts, and AI services are not included. Some menus expose disabled entries for these features. X preview and link-preview service integrations are not connected.

The footer contains an `{{{UNSUBSCRIBE_URL}}}` placeholder. Replace it with your application's unsubscribe URL before sending an email. Exported documents still need testing in the email clients you intend to support.

## Contributing

Issues and pull requests are welcome. Include steps to reproduce a bug and, for UI changes, screenshots showing the affected state. Run the relevant checks before submitting a change.

## License

[MIT](LICENSE). Bundled third-party assets retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
