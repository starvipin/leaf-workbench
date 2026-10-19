# Direct dependency inventory

Recorded from the installed packages and lockfile on **19 October 2026**.
Versions below are resolved versions, rather than the ranges in package.json.

The inventory covers all direct npm dependencies. Transitive versions and
package integrity records are retained in [package-lock.json](../package-lock.json).
Licenses are the packages' declared metadata, not an independent license audit.

## Runtime dependencies

| Package | Version | Declared license | Role | Upstream / package |
| --- | --- | --- | --- | --- |
| `react` | 19.3.1 | MIT | UI components and state | [Source](https://github.com/react/react) · [npm](https://www.npmjs.com/package/react) |
| `react-dom` | 19.3.1 | MIT | Browser rendering | [Source](https://github.com/react/react) · [npm](https://www.npmjs.com/package/react-dom) |
| `lucide-react` | 0.468.0 | ISC | Interface icons | [Source](https://github.com/lucide-icons/lucide) · [npm](https://www.npmjs.com/package/lucide-react) |
| `@codemirror/state` | 6.7.6 | MIT | Editor document and transactions | [Source](https://code.haverbeke.berlin/codemirror/state) · [npm](https://www.npmjs.com/package/@codemirror/state) |
| `@codemirror/view` | 6.43.14 | MIT | Editor view, gutters and selection | [Source](https://code.haverbeke.berlin/codemirror/view) · [npm](https://www.npmjs.com/package/@codemirror/view) |
| `@codemirror/commands` | 6.11.1 | MIT | Editing commands and undo/redo | [Source](https://code.haverbeke.berlin/codemirror/commands) · [npm](https://www.npmjs.com/package/@codemirror/commands) |
| `@codemirror/language` | 6.13.1 | MIT | Language parsing and highlighting | [Source](https://code.haverbeke.berlin/codemirror/language) · [npm](https://www.npmjs.com/package/@codemirror/language) |
| `@codemirror/legacy-modes` | 6.5.5 | MIT | LaTeX / stex language mode | [Source](https://code.haverbeke.berlin/codemirror/legacy-modes) · [npm](https://www.npmjs.com/package/@codemirror/legacy-modes) |
| `@codemirror/search` | 6.7.2 | MIT | Source search | [Source](https://code.haverbeke.berlin/codemirror/search) · [npm](https://www.npmjs.com/package/@codemirror/search) |
| `@codemirror/autocomplete` | 6.20.3 | MIT | Bracket completion | [Source](https://code.haverbeke.berlin/codemirror/autocomplete) · [npm](https://www.npmjs.com/package/@codemirror/autocomplete) |
| `pdfjs-dist` | 5.7.284 | Apache-2.0 | PDF parsing and rendering | [Source](https://github.com/mozilla/pdf.js) · [npm](https://www.npmjs.com/package/pdfjs-dist) |
| `express` | 5.3.0 | MIT | Local HTTP API and built frontend | [Source](https://github.com/expressjs/express) · [npm](https://www.npmjs.com/package/express) |

## Development dependencies

| Package | Version | Declared license | Role | Upstream / package |
| --- | --- | --- | --- | --- |
| `typescript` | 5.9.3 | Apache-2.0 | Type checking | [Source](https://github.com/microsoft/TypeScript) · [npm](https://www.npmjs.com/package/typescript) |
| `vite` | 7.3.7 | MIT | Development server and production build | [Source](https://github.com/vitejs/vite) · [npm](https://www.npmjs.com/package/vite) |
| `@vitejs/plugin-react` | 5.2.0 | MIT | React integration for Vite | [Source](https://github.com/vitejs/vite-plugin-react) · [npm](https://www.npmjs.com/package/@vitejs/plugin-react) |
| `@types/react` | 19.3.0 | MIT | React TypeScript declarations | [Source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [npm](https://www.npmjs.com/package/@types/react) |
| `@types/react-dom` | 19.3.0 | MIT | React DOM TypeScript declarations | [Source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [npm](https://www.npmjs.com/package/@types/react-dom) |
| `@types/node` | 24.19.2 | MIT | Node.js TypeScript declarations | [Source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [npm](https://www.npmjs.com/package/@types/node) |
| `playwright-core` | 1.64.1 | Apache-2.0 | Browser testing support | [Source](https://github.com/microsoft/playwright) · [npm](https://www.npmjs.com/package/playwright-core) |

## Development tools installed separately

| Tool | Recorded version | Role | Upstream |
| --- | --- | --- | --- |
| REA / rea-agents | 6.7.0 | Reference inspection and browser verification | [morluto/rea](https://github.com/morluto/rea) |
| Tectonic | 0.17.0 | Runtime LaTeX compiler, downloaded by the setup script | [tectonic-typesetting/tectonic](https://github.com/tectonic-typesetting/tectonic) |
| Node.js | 24.18.0 | Verified JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| npm | 11.16.0 | Verified package manager | [npm CLI](https://github.com/npm/cli) |
| Chrome | 155.0.8059.85 | Browser verification | [Google Chrome](https://www.google.com/chrome/) |

Codex was used during development, not as an application dependency.
Tectonic setup and download provenance are documented in
[ACKNOWLEDGEMENTS.md](../ACKNOWLEDGEMENTS.md).
