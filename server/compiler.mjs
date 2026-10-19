import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outputRoot = path.join(projectRoot, '.data', 'output');
const jobsRoot = path.join(projectRoot, '.data', 'jobs');
const cacheRoot = path.join(projectRoot, '.cache', 'tectonic');
const fontconfigRoot = path.join(projectRoot, '.cache', 'fontconfig');
const compilerPath = process.env.TECTONIC_PATH || path.join(projectRoot, 'tools', 'tectonic', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
const MAX_LOG = 192 * 1024;
const MAX_PDF = 32 * 1024 * 1024;
let active = false;

async function run(args, { cwd = projectRoot, timeout = 120000, monitorOutput = false } = {}) {
  const environment = { ...process.env, TECTONIC_CACHE_DIR: cacheRoot, TECTONIC_UNTRUSTED_MODE: '1' };
  if (process.platform === 'win32') {
    await fs.mkdir(fontconfigRoot, { recursive: true });
    const config = path.join(fontconfigRoot, 'fonts.conf');
    const xmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    await fs.writeFile(config, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${xmlEscape(path.join(process.env.WINDIR || 'C:/Windows', 'Fonts').replaceAll('\\', '/'))}</dir><cachedir>${xmlEscape(fontconfigRoot.replaceAll('\\', '/'))}</cachedir></fontconfig>`);
    environment.FONTCONFIG_FILE = config;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(compilerPath, args, { cwd, shell: false, windowsHide: true, env: environment });
    let log = '';
    let timedOut = false;
    let truncated = false;
    let resourceLimit = false;
    let inspecting = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    const diskTimer = monitorOutput ? setInterval(async () => {
      if (inspecting) return;
      inspecting = true;
      try {
        const files = await fs.readdir(cwd, { recursive: true, withFileTypes: true });
        let bytes = 0;
        for (const file of files) {
          if (file.isFile()) bytes += (await fs.stat(path.join(file.parentPath, file.name))).size;
          if (bytes > 64 * 1024 * 1024 || files.length > 1000) { resourceLimit = true; child.kill('SIGKILL'); break; }
        }
      } catch { /* The compiler may remove intermediate files while we inspect. */ }
      finally { inspecting = false; }
    }, 1000) : null;
    const clearTimers = () => { clearTimeout(timer); if (diskTimer) clearInterval(diskTimer); };
    const append = chunk => {
      if (log.length < MAX_LOG) log += chunk.toString().slice(0, MAX_LOG - log.length);
      else truncated = true;
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', error => { clearTimers(); reject(error); });
    child.once('close', code => {
      clearTimers();
      resolve({ code, log: log + (truncated ? '\n[Compiler log truncated.]' : '') + (timedOut ? '\nCompilation timed out after 120 seconds.' : '') + (resourceLimit ? '\nCompilation exceeded the temporary file limit (64 MB / 1000 entries).' : ''), timedOut, resourceLimit });
    });
  });
}

export async function compilerStatus() {
  try {
    const result = await run(['--version'], { timeout: 5000 });
    return { available: result.code === 0, version: result.log.trim(), engine: 'Tectonic' };
  } catch {
    return { available: false, engine: 'Tectonic', setup: 'Run powershell -ExecutionPolicy Bypass -File scripts/setup-tex.ps1' };
  }
}

export function validateProject(body) {
  if (!body || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > 64) throw new Error('Provide between 1 and 64 source files.');
  const seen = new Set();
  let total = 0;
  for (const file of body.files) {
    if (!file || typeof file.name !== 'string' || typeof file.content !== 'string') throw new Error('Every file needs a name and text content.');
    const name = file.name;
    if (name.length > 180 || !/^[A-Za-z0-9_ .\-/]+\.(tex|bib|sty|cls|bst|txt|md)$/i.test(name) || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) throw new Error('Source names must be safe relative paths ending in .tex, .bib, .sty, .cls, .bst, .txt, or .md.');
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error('Source filenames must be unique.');
    seen.add(key);
    total += Buffer.byteLength(file.content, 'utf8');
    if (total > 2 * 1024 * 1024) throw new Error('Project source exceeds the 2 MB limit.');
  }
  const mainFile = body.mainFile || 'main.tex';
  if (typeof mainFile !== 'string' || !mainFile.endsWith('.tex') || !body.files.some(file => file.name === mainFile)) throw new Error('Select an existing .tex file as the main document.');
  return { files: body.files, mainFile };
}

function parseErrors(log, mainFile) {
  const errors = [];
  for (const row of log.split(/\r?\n/)) {
    const located = row.match(/(?:error:\s*)?([^:\s]+\.tex):(\d+):\s*(.+)/);
    if (located) errors.push({ file: located[1], line: Number(located[2]), message: located[3] });
    else if (/^error:|^!/.test(row.trim())) errors.push({ file: mainFile, message: row.trim().replace(/^(error:|!)\s*/, '') });
    if (errors.length >= 20) break;
  }
  return errors;
}

export async function compileProject(body) {
  const project = validateProject(body);
  if (active) { const error = new Error('A compilation is already running. Please try again when it finishes.'); error.status = 429; throw error; }
  active = true;
  const start = performance.now();
  const id = randomUUID();
  const directory = path.join(jobsRoot, id);
  try {
    await Promise.all([fs.mkdir(directory, { recursive: true }), fs.mkdir(outputRoot, { recursive: true }), fs.mkdir(cacheRoot, { recursive: true })]);
    for (const file of project.files) {
      const target = path.join(directory, file.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf8');
    }
    const outdir = path.join(directory, '_compiled');
    await fs.mkdir(outdir);
    let result;
    try {
      result = await run(['--untrusted', '--keep-logs', '--keep-intermediates', '--outdir', outdir, '--', project.mainFile], { cwd: directory, monitorOutput: true });
    } catch (error) {
      if (error.code === 'ENOENT') throw Object.assign(new Error('Tectonic is not installed. Run scripts/setup-tex.ps1 and restart the server.'), { status: 503 });
      throw error;
    }
    const errors = parseErrors(result.log, project.mainFile);
    const pdfPath = path.join(outdir, path.basename(project.mainFile, '.tex') + '.pdf');
    let success = result.code === 0 && !result.timedOut && !result.resourceLimit;
    if (success) {
      const stat = await fs.stat(pdfPath).catch(() => null);
      success = Boolean(stat && stat.size > 4 && stat.size <= MAX_PDF);
      if (!success) errors.push({ message: 'Compiler did not produce a PDF within the 32 MB limit.' });
    }
    if (success) await fs.copyFile(pdfPath, path.join(outputRoot, `${id}.pdf`));
    else if (!errors.length) errors.push({ message: result.timedOut ? 'Compilation timed out.' : 'Compilation failed. Check the compiler log.' });
    const outputFiles = await fs.readdir(outputRoot);
    const dated = await Promise.all(outputFiles.filter(name => /^[0-9a-f-]+\.pdf$/.test(name)).map(async name => ({ name, stat: await fs.stat(path.join(outputRoot, name)) })));
    dated.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    await Promise.all(dated.filter((entry, index) => index >= 64 || Date.now() - entry.stat.mtimeMs > 86400000).map(entry => fs.unlink(path.join(outputRoot, entry.name))));
    return { success, ...(success ? { pdfUrl: `/api/output/${id}.pdf` } : {}), log: result.log, errors: success ? [] : errors, durationMs: Math.round(performance.now() - start) };
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    active = false;
  }
}
