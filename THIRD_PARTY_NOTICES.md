# Third-party notices

The project's MIT license covers its original code and artwork. The following bundled assets and adapted source retain their own licenses. Dependency licenses are distributed with the corresponding packages.

## Fonts

Both font binaries are unmodified downloads from the official upstream repositories. The local filenames are application asset paths.

### Inter

- Local file: `src/app/fonts/inter-variable.woff2`
- Copyright (c) 2016 The Inter Project Authors.
- License: SIL Open Font License 1.1; the complete copyright and license are in [public/fonts/LICENSE-INTER.txt](public/fonts/LICENSE-INTER.txt).
- Source: [InterVariable.woff2 at commit 353b61b9f4430d5f420d56605a6e7993e0941470](https://github.com/rsms/inter/blob/353b61b9f4430d5f420d56605a6e7993e0941470/docs/font-files/InterVariable.woff2).
- SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.

### Commit Mono

- Local file: `public/fonts/commit-mono-regular.woff2`
- Copyright (c) 2023 Eigil Nikolajsen.
- License: SIL Open Font License 1.1; the complete copyright and license are in [public/fonts/LICENSE-COMMIT-MONO.txt](public/fonts/LICENSE-COMMIT-MONO.txt).
- Source: [CommitMonoV143-VF.woff2 at commit d407cd2bf8e01ca1db70544052fbbb9606406c3b](https://github.com/eigilnikolajsen/commit-mono/blob/d407cd2bf8e01ca1db70544052fbbb9606406c3b/src/fonts/fontlab/CommitMonoV143-VF.woff2).
- SHA-256: `f342ca6c3f2597e6c0fcd84b3f3ed64d3ce5bdb6d0af19d190d645a558b1cf29`.
- The upstream variable font is used at weight 400 by the application's existing font-face declaration.

## Syntax themes

The theme names and asset paths match the editor's theme attributes. Upstream CSS selectors are scoped to their corresponding `data-theme` values so multiple code-block themes can coexist.

### Prism default theme

`public/styles/prism/prism-default.css` is adapted from [Prism's default stylesheet at commit 298b75f1764c4abfe76d997394b7b149845f685a](https://github.com/PrismJS/prism/blob/298b75f1764c4abfe76d997394b7b149845f685a/themes/prism.css). It is MIT licensed, copyright (c) 2012 Lea Verou. The complete license is in [public/styles/prism/LICENSE-PRISM.txt](public/styles/prism/LICENSE-PRISM.txt).

### Prism themes

The following files are adapted from [PrismJS/prism-themes at commit 447479fc7b2be2051fe27e561aceed7cc87a589f](https://github.com/PrismJS/prism-themes/tree/447479fc7b2be2051fe27e561aceed7cc87a589f/themes). They are MIT licensed, copyright (c) 2015 PrismJS. Theme-author attribution from the upstream stylesheets is retained. The complete license is in [public/styles/prism/LICENSE-PRISM-THEMES.txt](public/styles/prism/LICENSE-PRISM-THEMES.txt).

| Local file in `public/styles/prism/` | Upstream file in `themes/` |
| --- | --- |
| `prism-atomDark.css` | `prism-atom-dark.css` |
| `prism-oneLight.css` | `prism-one-light.css` |
| `prism-dracula.css` | `prism-dracula.css` |
| `prism-nord.css` | `prism-nord.css` |
| `prism-duotoneDark.css` | `prism-duotone-dark.css` |
| `prism-duotoneForest.css` | `prism-duotone-forest.css` |
| `prism-duotoneLight.css` | `prism-duotone-light.css` |
| `prism-duotoneSea.css` | `prism-duotone-sea.css` |
| `prism-duotoneSpace.css` | `prism-duotone-space.css` |
| `prism-vs.css` | `prism-vs.css` |
| `prism-vscDarkPlus.css` | `prism-vsc-dark-plus.css` |

Only selector scoping and formatting are changed from these upstream stylesheets; their declarations remain intact.

### Vesper palette

`public/styles/prism/prism-vesper.css` is an original Prism CSS adaptation of the [Vesper palette at commit 9043f3849b776949445f0cd4990365959cca35a3](https://github.com/raunofreiberg/vesper/blob/9043f3849b776949445f0cd4990365959cca35a3/themes/Vesper-dark-color-theme.json). The palette is MIT licensed, copyright (c) 2023 Rauno Freiberg. The complete upstream license is in [public/styles/prism/LICENSE-VESPER.txt](public/styles/prism/LICENSE-VESPER.txt). The CSS adaptation is distributed under the project's MIT license.

## Icons

### Tabler Icons

The editor's UI icon geometry and SVG files in `public/icons/tabler/` are adapted from [Tabler Icons at commit a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d](https://github.com/tabler/tabler-icons/tree/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d). They are MIT licensed, copyright (c) 2020-2026 Paweł Kuna. The complete license is in [public/icons/tabler/LICENSE](public/icons/tabler/LICENSE). Individual upstream URLs, hashes, and UI mappings are recorded in [public/icons/tabler/PROVENANCE.json](public/icons/tabler/PROVENANCE.json).

### Simple Icons

The Open Collective, Substack, and DEV SVG files in `public/icons/simple-icons/` are from [Simple Icons at commit 98820a4dc8c363ca72fa2c0d294ea4a0a9bba75d](https://github.com/simple-icons/simple-icons/tree/98820a4dc8c363ca72fa2c0d294ea4a0a9bba75d). They are distributed under CC0 1.0. The complete dedication and license are in [public/icons/simple-icons/LICENSE.md](public/icons/simple-icons/LICENSE.md), with individual sources and hashes in [public/icons/simple-icons/PROVENANCE.json](public/icons/simple-icons/PROVENANCE.json). Brand names and marks belong to their respective owners.

The neutral SVG placeholders in `public/media/` are original project artwork distributed under the project's MIT license.

## Adapted editor source

This project uses and includes adaptations of source from [@react-email/editor 1.7.10](https://www.npmjs.com/package/@react-email/editor/v/1.7.10). Its MIT notice is reproduced below.

Copyright 2026 Plus Five Five, Inc

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
