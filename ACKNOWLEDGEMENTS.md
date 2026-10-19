# Acknowledgements and reference provenance

This document records the tools, reference material, and dependencies used to
build Leaf Workbench. It distinguishes implementation work, interface inspiration,
development tooling, and runtime dependencies.

## Project and implementation credits

| Contributor/tool | Contribution |
| --- | --- |
| [starvipin](https://github.com/starvipin) | Project direction, requested behavior, and repository ownership |
| [OpenAI Codex](https://openai.com/codex/) | AI-assisted coding, integration, debugging, browser checks, documentation, and Git milestones |
| Codex editor sub-agent | CodeMirror editor, formatting commands, source search/navigation, and alignment checks |
| Codex PDF preview sub-agent | PDF.js viewer, rendering lifecycle, page controls, zoom, and downloads |
| Codex compiler/backend sub-agent | Verified Tectonic setup, Express API, queueing, resource limits, and real compiler tests |

The sub-agents were part of the development session. Running this app does not
invoke Codex, call an AI API, or require a Codex account.

## REA: the primary investigation and verification tool

**[REA — Reverse Engineer Anything](https://github.com/morluto/rea)** is maintained
by **[morluto](https://github.com/morluto)** and upstream contributors.

| Reference | Purpose |
| --- | --- |
| [Official repository](https://github.com/morluto/rea) | Development tool and upstream documentation |
| [Official npm package](https://www.npmjs.com/package/rea-agents) | Installed CLI: `rea-agents@6.7.0` |
| [Inspected source revision](https://github.com/morluto/rea/tree/ba866a26ecbe179a717e746cbc0d1605ae616ad5) | Source snapshot prepared during development |
| [Installation guide](https://github.com/morluto/rea/blob/ba866a26ecbe179a717e746cbc0d1605ae616ad5/docs/installation.md) | CLI/provider setup and environment requirements |
| [Browser observation guide](https://github.com/morluto/rea/blob/ba866a26ecbe179a717e746cbc0d1605ae616ad5/docs/browser-observation.md) | Browser capture workflow and evidence scope |
| [Scenario input implementation](https://github.com/morluto/rea/blob/ba866a26ecbe179a717e746cbc0d1605ae616ad5/src/domain/browserScenarioValues.ts) | Contract consulted when constructing browser scenarios |
| [REA license at the inspected revision](https://github.com/morluto/rea/blob/ba866a26ecbe179a717e746cbc0d1605ae616ad5/LICENSE) | Upstream MIT license and attribution |

### What REA did

1. Opened the supplied Overleaf project route in an isolated Chrome profile.
2. Recorded the resulting public-page URL, DOM, accessibility, and screenshot.
3. Drove the finished Leaf app through project creation, LaTeX edits, compiler
   errors and recovery, PDF rendering, and source persistence across reload.

The Overleaf route redirected to login. REA did not retrieve private projects,
authenticate to an Overleaf account, recover private source, or establish
Overleaf's internal implementation. Leaf's behavior was implemented separately.

The committed scenarios are original project test inputs:

- [`research/overleaf-scenario.json`](research/overleaf-scenario.json)
- [`research/workspace-scenario.json`](research/workspace-scenario.json)

Local captures carry these evidence identities:

| Capture | Evidence ID |
| --- | --- |
| Public Overleaf route inspection | `ev_a04bc74115c2182ead1813262ff27b1591885a8601cc3c99784ef180d70c1e02` |
| Final Leaf browser verification | `ev_eae3ad3b3671b66ee0615e75ea181d91594c084254f7dd47e6317ff5b02439d6` |

These identify local development evidence, not public retrieval URLs. Raw
captures and generated reports are excluded from Git. The selected README
screenshot shows this app with an original test document.

## Overleaf: interface inspiration and public workflow references

| Source consulted | How it informed the project |
| --- | --- |
| [Requested project route](https://www.overleaf.com/project) | Starting point for investigation; redirected to login |
| [Redesigned editor guide](https://docs.overleaf.com/getting-started/how-do-i-use-overleaf/redesigned-overleaf-editor) | Public reference for source/PDF pane placement, project navigation, file tree, and diagnostics |
| [Recompiling a project](https://docs.overleaf.com/getting-started/recompiling-your-project) | Reference for the edit → recompile → PDF workflow |
| [Layout menu](https://www.overleaf.com/learn/how-to/How_to_use_the_Overleaf_layout_menu) | Public layout reference surfaced during research |
| [PDF viewer options](https://docs.overleaf.com/navigating-in-the-editor/working-with-the-pdf-viewer/pdf-viewer-options-and-navigation) | Public navigation and zoom reference surfaced during research |

Leaf uses its own branding, application code, styles, and example documents.
Overleaf's logos, source, private data, and screenshots are not included in this
repository. Public documentation served as reference material.

## Tectonic: real PDF compilation

- Project: [tectonic-typesetting/tectonic](https://github.com/tectonic-typesetting/tectonic).
- Website: [The Tectonic Project](https://tectonic-typesetting.github.io/).
- Pinned release: [Tectonic 0.17.0](https://github.com/tectonic-typesetting/tectonic/releases/tag/tectonic%400.17.0).
- Windows archive: [`tectonic-0.17.0-x86_64-pc-windows-msvc.zip`](https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip).
- Published asset metadata: [official release API](https://api.github.com/repos/tectonic-typesetting/tectonic/releases/tags/tectonic%400.17.0).
- Installer: [`scripts/setup-tex.ps1`](scripts/setup-tex.ps1).

The installer checks this SHA-256 before extracting the binary:

```text
f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f
```

The downloaded compiler and package cache remain local and are excluded from Git.
TeX packages and fonts downloaded by the engine retain their own upstream terms;
they are not authored by Leaf Workbench.

## Runtime libraries and development dependencies

The complete direct dependency inventory is in
[`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md), including installed versions,
declared licenses, source repositories, and roles. It was generated from this
checkout's package metadata. [`package-lock.json`](package-lock.json) records
the resolved npm dependency graph used by `npm ci`.

| Library/tool | Official reference |
| --- | --- |
| React / React DOM | [react.dev](https://react.dev/) · [react/react](https://github.com/react/react) |
| CodeMirror 6 and its LaTeX mode | [CodeMirror](https://codemirror.net/) · [legacy modes](https://github.com/codemirror/legacy-modes) |
| PDF.js / `pdfjs-dist` | [PDF.js](https://mozilla.github.io/pdf.js/) · [mozilla/pdf.js](https://github.com/mozilla/pdf.js) |
| Express | [expressjs.com](https://expressjs.com/) · [expressjs/express](https://github.com/expressjs/express) |
| Vite / React plugin | [vite.dev](https://vite.dev/) · [vitejs/vite](https://github.com/vitejs/vite) |
| TypeScript | [typescriptlang.org](https://www.typescriptlang.org/) · [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| Lucide React | [lucide.dev](https://lucide.dev/) · [lucide-icons/lucide](https://github.com/lucide-icons/lucide) |
| Playwright Core | [playwright.dev](https://playwright.dev/) · [microsoft/playwright](https://github.com/microsoft/playwright) |
| Node.js / npm | [nodejs.org](https://nodejs.org/) · [npm documentation](https://docs.npmjs.com/) |

## Typography and visual assets

The interface requests these fonts through the Google Fonts CSS API in
[`src/styles.css`](src/styles.css), with system-font fallbacks:

- [DM Sans](https://fonts.google.com/specimen/DM+Sans) —
  [upstream files and license](https://github.com/google/fonts/tree/main/ofl/dmsans).
- [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) —
  [upstream files and license](https://github.com/google/fonts/tree/main/ofl/instrumentsans).

Interface icons come from Lucide React. The article, blank document, letter,
and verification document were written for this implementation. PDF typesetting
fonts are supplied by the TeX engine/package bundle.

## License and affiliation notes

Third-party projects retain their own licenses and notices. Tool credit does
not transfer an upstream tool's license to this separate application. This
repository currently does not contain a top-level application `LICENSE` file.

These credits describe how the project was built. They do not imply endorsement
by Overleaf, morluto/REA, OpenAI, or the other upstream maintainers.
