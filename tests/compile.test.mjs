import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server/index.mjs';
import { validateProject } from '../server/compiler.mjs';

let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('rejects traversal, Windows device filenames, duplicates, and missing main files', () => {
  for (const name of ['../main.tex', '/main.tex', 'C:/main.tex', 'folder/../main.tex', 'NUL.tex', 'folder./main.tex']) assert.throws(() => validateProject({ files: [{ name, content: '' }], mainFile: name }));
  assert.throws(() => validateProject({ files: [{ name: 'main.tex', content: '' }, { name: 'MAIN.tex', content: '' }] }));
  assert.throws(() => validateProject({ files: [{ name: 'main.tex', content: '' }], mainFile: 'other.tex' }));
});

test('health detects the real installed compiler', async () => {
  const response = await fetch(`${base}/api/health`);
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.compiler.available, true, JSON.stringify(health));
  assert.match(health.compiler.version, /Tectonic/i);
});

test('real multi-file LaTeX compiles to a downloadable PDF', { timeout: 300000 }, async () => {
  const response = await fetch(`${base}/api/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mainFile: 'main.tex', files: [
    { name: 'main.tex', content: '\\documentclass{article}\n\\usepackage{amsmath}\n\\title{Verified Workbench}\\author{Local Test}\n\\begin{document}\\maketitle\\input{sections/body}\\end{document}' },
    { name: 'sections/body.tex', content: '\\section{Working PDF}\nAn actual typeset document with mathematics: \\(e^{i\\pi}+1=0\\).\n' },
  ] }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, true, result.log);
  assert.deepEqual(result.errors, []);
  assert.ok(result.durationMs > 0);
  const pdf = await fetch(`${base}${result.pdfUrl}`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.byteLength > 1000);
});

test('real malformed LaTeX reports actionable compiler errors without a PDF', { timeout: 300000 }, async () => {
  const response = await fetch(`${base}/api/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ name: 'main.tex', content: '\\documentclass{article}\n\\begin{document}\n\\thisCommandDoesNotExist\n\\end{document}' }] }) });
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(result.pdfUrl, undefined);
  assert.ok(result.errors.length);
  assert.match(result.log, /Undefined control sequence/i);
});

test('the actual starter article compiles with its fonts and packages', { timeout: 300000 }, async () => {
  const templates = await readFile(new URL('../src/templates.ts', import.meta.url), 'utf8');
  const article = templates.match(/export const articleSource = String\.raw`([\s\S]+?)`;/)?.[1];
  assert.ok(article, 'Starter article source exists.');
  const response = await fetch(`${base}/api/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ name: 'main.tex', content: article }] }) });
  const result = await response.json();
  assert.equal(result.success, true, result.log);
  assert.ok(result.pdfUrl);
});

test('rejects foreign origins and invalid output names', async () => {
  assert.equal((await fetch(`${base}/api/compile`, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/output/private.pdf`)).status, 404);
});
