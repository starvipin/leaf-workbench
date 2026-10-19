import test from "node:test";
import assert from "node:assert/strict";
import {
  CompilationCoordinator,
  reviseProject,
  savedSourceRevision,
} from "../src/compilation.ts";

const project = (sourceRevision, id = "project-a") => ({
  id,
  sourceRevision,
  name: "Race regression",
  starred: false,
  updatedAt: 1,
  files: [{ name: "main.tex", content: `Source revision ${sourceRevision}` }],
});
const success = (pdfUrl) => ({
  success: true,
  pdfUrl,
  log: "Compiled",
  errors: [],
  durationMs: 1,
});
function harness() {
  const requests = [];
  const compiler = new CompilationCoordinator(
    (source) =>
      new Promise((resolve, reject) => {
        requests.push({ source, resolve, reject });
      }),
  );
  return { compiler, requests };
}

test("an older successful build finishing last cannot replace the newer PDF", async () => {
  const { compiler, requests } = harness();
  const older = compiler.compile(project(1));
  const newer = compiler.compile(project(2));
  requests[1].resolve(success("/newer.pdf"));
  await newer;
  const newerState = compiler.getSnapshot();
  requests[0].resolve(success("/older.pdf"));
  assert.equal(await older, null);
  assert.equal(
    compiler.getSnapshot(),
    newerState,
    "Superseded completion publishes no UI state.",
  );
  assert.equal(newerState["project-a"].result.pdfUrl, "/newer.pdf");
  assert.equal(newerState["project-a"].result.pdfSourceRevision, 2);
});

test("a late older network failure cannot replace newer success or open a stale error", async () => {
  const { compiler, requests } = harness();
  const older = compiler.compile(project(1));
  const newer = compiler.compile(project(2));
  requests[1].resolve(success("/newer.pdf"));
  await newer;
  requests[0].reject(new Error("Old request failed"));
  assert.equal(await older, null);
  assert.equal(compiler.getSnapshot()["project-a"].result.success, true);
  assert.deepEqual(compiler.getSnapshot()["project-a"].result.errors, []);
});

test("an older response cannot clear the busy state of a newer pending build", async () => {
  const { compiler, requests } = harness();
  const older = compiler.compile(project(1));
  const newer = compiler.compile(project(2));
  requests[0].resolve(success("/older.pdf"));
  await older;
  assert.equal(compiler.getSnapshot()["project-a"].pendingRevision, 2);
  assert.equal(compiler.getSnapshot()["project-a"].result, undefined);
  requests[1].resolve(success("/newer.pdf"));
  await newer;
  assert.equal(compiler.getSnapshot()["project-a"].pendingRevision, null);
});

test("newest failure keeps the previous PDF's revision, even when an older success arrives later", async () => {
  const { compiler, requests } = harness();
  const initial = compiler.compile(project(1));
  requests[0].resolve(success("/first.pdf"));
  await initial;
  const older = compiler.compile(project(2));
  const newer = compiler.compile(project(3));
  requests[2].resolve({
    success: false,
    log: "Undefined command",
    errors: [{ message: "Undefined command" }],
    durationMs: 1,
  });
  await newer;
  requests[1].resolve(success("/second.pdf"));
  await older;
  const state = compiler.getSnapshot()["project-a"].result;
  assert.equal(state.sourceRevision, 3);
  assert.equal(state.success, false);
  assert.equal(state.pdfUrl, "/first.pdf");
  assert.equal(
    state.pdfSourceRevision,
    1,
    "A failed attempt must never relabel the retained PDF.",
  );
});

test("compile captures a source snapshot and deduplicates the same pending revision", async () => {
  const { compiler, requests } = harness();
  const source = project(1);
  const build = compiler.compile(source);
  assert.equal(await compiler.compile(source), null);
  source.files[0].content = "Edited while building";
  source.sourceRevision = 2;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].source.files[0].content, "Source revision 1");
  requests[0].resolve(success("/snapshot.pdf"));
  await build;
  assert.equal(compiler.getSnapshot()["project-a"].result.pdfSourceRevision, 1);
});

test("overlapping builds in separate projects keep independent result and busy state", async () => {
  const { compiler, requests } = harness();
  const a = compiler.compile(project(1));
  const b = compiler.compile(project(8, "project-b"));
  requests[1].resolve(success("/b.pdf"));
  await b;
  assert.equal(compiler.getSnapshot()["project-a"].pendingRevision, 1);
  requests[0].resolve(success("/a.pdf"));
  await a;
  assert.equal(compiler.getSnapshot()["project-a"].result.pdfSourceRevision, 1);
  assert.equal(compiler.getSnapshot()["project-b"].result.pdfSourceRevision, 8);
});

test("only source changes advance revisions; restoring older content never rolls the counter back", () => {
  const first = project(4);
  assert.equal(
    reviseProject(first, { ...first, name: "Renamed" }).sourceRevision,
    4,
  );
  assert.equal(reviseProject(first, structuredClone(first)).sourceRevision, 4);
  const second = reviseProject(first, {
    ...first,
    files: [{ name: "main.tex", content: "New source" }],
  });
  assert.equal(second.sourceRevision, 5);
  assert.equal(reviseProject(second, first).sourceRevision, 6);
  assert.equal(
    savedSourceRevision(undefined),
    1,
    "Legacy browser projects migrate without losing source.",
  );
  assert.equal(savedSourceRevision(12), 12);
});
