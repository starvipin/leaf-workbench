# Leaf — a local LaTeX workspace

An Overleaf-inspired editor built using REA observations, public Overleaf
documentation, and three implementation sub-agents. Write LaTeX in a highlighted
source editor and compile it into an actual PDF in the adjacent viewer.

## Run

The dependencies, verified Tectonic 0.17.0 binary, and common TeX packages are
already installed on this computer.

```powershell
Set-Location 'C:\Users\starv\Desktop\test-rea\leaf-workbench'
npm run dev
```

Open **http://127.0.0.1:5173**. The compiler API runs on port 3001, and Vite
proxies its requests. Ctrl+C stops the development server and its child processes.

For a production build:

```powershell
npm run build
npm start
```

Then open **http://127.0.0.1:3001**. Browser storage belongs to its origin: export
a project backup from the development URL before moving projects to this URL.

## Included

- CodeMirror LaTeX editor: syntax highlighting, line numbers, undo/redo, search,
  formatting commands, cursor position, line wrapping, and configurable font size.
- Real Tectonic compilation of text source projects with equations and standard
  LaTeX packages, including multi-file `\input` projects.
- PDF.js viewer: zoom, fit to width, page navigation, and actual PDF download.
- Manual compile with Ctrl/Cmd+Enter or Ctrl/Cmd+S, plus optional automatic compile.
- Actionable compiler errors and logs, preserving the previous successful PDF.
- Project dashboard, name editing, starring, duplication, search, list/grid views,
  blank/article/letter templates, and automatic browser-local saving.
- File creation, source import, project backup export/import, document outline,
  local checkpoints and restore, and keyboard/pointer pane resizing.
- Desktop split view, editor/PDF focus modes, and a stacked layout on small screens.

Click **Projects** to use the dashboard. Click the project title to rename it.
Use the **File** menu to download the current `.tex` source or export a complete
`.leaf.json` backup. Project backups include all text source files.

## Compiler setup on another Windows machine

Requires Node.js 22.12+ (Node 24 recommended), npm, and Windows x64.

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/setup-tex.ps1
npm run dev
```

The setup script downloads the official Tectonic 0.17.0 Windows release, verifies
its published SHA-256, and compiles a document to warm the official TeX bundle.
The first package download can take several minutes. Additional uncached LaTeX
packages require internet access. The Windows binary and cache are ignored by Git;
the reproducible setup script is committed. On another platform, install Tectonic
and set `TECTONIC_PATH` to its executable before starting the app.

The compiler is a local service for trusted documents. It binds to loopback,
rejects foreign origins/hosts, validates relative source paths, disables shell
escape through Tectonic's untrusted mode, and bounds compilation and output size.
Tectonic is not an OS sandbox. Keep the service local rather than exposing it as
a public arbitrary-document compiler. Up to four jobs are queued and compiled
one at a time.

## Verification

```powershell
npm test
npm run build
```

The integration suite uses the installed compiler, not a mock. It tests real
multi-file PDFs and download bytes, the actual starter article, invalid TeX,
CSV source data, concurrent jobs and queue capacity, health, source-path handling,
and origin restrictions.

REA also drove the actual browser through new-project creation, source editing,
intentional compiler failure, repair, successful PDF rendering, and a reload that
restored and recompiled the saved source. Every scenario step completed.
Local verification reports and screenshots are retained under `research/` and
excluded from Git. The replayable scenario is included in
`research/workspace-scenario.json`. Run the scenario with the previously installed
`rea capture-browser-scenario <scenario-file> --json` while the dev server is up.

The editor additionally passed browser checks for formatting, undo, source search,
outline navigation, and exact gutter/source line alignment. The viewer parsed an
actual compiled A4 PDF and its document text.

## Reference scope

REA inspected the user-supplied `https://www.overleaf.com/project` route in an
isolated Chrome profile. It redirected to login; authenticated projects and
private editor behavior were not accessed. The captured evidence identity and
scope are recorded locally in the ignored `research/observations.json` report.
Interface behavior was also
informed by Overleaf's [public editor guide](https://docs.overleaf.com/getting-started/how-do-i-use-overleaf/redesigned-overleaf-editor)
and [compilation guide](https://docs.overleaf.com/getting-started/recompiling-your-project).
The implementation is independent and uses its own branding and example content.

This version stores projects in the current browser and compiles on this computer.
It does not implement hosted accounts, multiplayer collaboration, SyncTeX source
mapping, Overleaf subscription features, or binary image uploads. Export backups
before clearing browser storage. Support for advanced TeX workflows depends on
Tectonic's package/engine support.
