import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compilerStatus,
  compileProject,
  validateProject,
  outputRoot,
  projectRoot,
} from "./compiler.mjs";

export function createApp() {
  const app = express();
  let outstandingCompiles = 0;
  let compileTail = Promise.resolve();
  const enqueueCompile = (project) => {
    // Four total jobs (one running, three waiting) bound request memory and wait time.
    if (outstandingCompiles >= 4)
      throw Object.assign(
        new Error("Compilation queue is full. Please retry shortly."),
        { status: 429 },
      );
    outstandingCompiles++;
    const job = compileTail.then(() => compileProject(project));
    compileTail = job
      .catch(() => {})
      .finally(() => {
        outstandingCompiles--;
      });
    return job;
  };
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Keep the compiler available only to this local app, including against DNS rebinding.
    const host = (req.headers.host || "").split(":")[0];
    if (!["127.0.0.1", "localhost"].includes(host))
      return res.status(403).json({ error: "Local access only." });
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      return res.status(403).json({ error: "Local origin required." });
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.get("/api/health", async (_req, res) =>
    res.json({ ok: true, compiler: await compilerStatus() }),
  );
  app.post("/api/compile", async (req, res) => {
    const start = performance.now();
    try {
      const project = validateProject(req.body);
      const result = await enqueueCompile(project);
      res.json({
        ...result,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (error) {
      res
        .status(error.status || 400)
        .json({
          success: false,
          log: error.message,
          errors: [{ message: error.message }],
          durationMs: Math.round(performance.now() - start),
        });
    }
  });
  app.get("/api/output/:filename", (req, res) => {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/.test(
        req.params.filename,
      )
    )
      return res.status(404).end();
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.sendFile(
      path.join(outputRoot, req.params.filename),
      { dotfiles: "allow" },
      (error) => {
        if (error && !res.headersSent) res.status(404).end();
      },
    );
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API endpoint." }),
  );
  app.use(express.static(path.join(projectRoot, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(projectRoot, "dist", "index.html")),
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.status || 500)
      .json({
        success: false,
        log:
          error.type === "entity.too.large"
            ? "Request exceeds the 3 MB limit."
            : error.message,
        errors: [{ message: error.message }],
        durationMs: 0,
      }),
  );
  return app;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3001);
  const server = createApp().listen(port, "127.0.0.1", () =>
    console.log(`Leaf Workbench: http://127.0.0.1:${port}`),
  );
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit()));
}
