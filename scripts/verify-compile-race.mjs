// Test-only local proxy: run the real compiler but deliberately deliver an older response last.
import express from "express";
import { createApp } from "../server/index.mjs";

const app = express();
app.use(express.json({ limit: "3mb" }));
let heldOlder;
let newerDelivered = false;
const observation = { order: [], olderSource: null, newerSource: null };
app.post("/api/compile", async (req, res) => {
  try {
    const text =
      req.body.files?.find((file) => file.name === "main.tex")?.content ?? "";
    const older = text.includes("OLDER_BUILD_MARKER");
    const newer = text.includes("NEWER_BUILD_MARKER");
    const upstream = await fetch("http://127.0.0.1:3001/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const result = await upstream.json();
    const deliver = () => {
      observation.order.push(older ? "older" : newer ? "newer" : "baseline");
      res.status(upstream.status).json(result);
    };
    if (older) {
      observation.olderSource = result.pdfUrl;
      heldOlder = deliver;
      if (newerDelivered)
        setTimeout(() => {
          heldOlder?.();
          heldOlder = null;
        }, 1200);
    } else {
      deliver();
      if (newer) {
        observation.newerSource = result.pdfUrl;
        newerDelivered = true;
        if (heldOlder)
          setTimeout(() => {
            heldOlder?.();
            heldOlder = null;
          }, 1200);
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/__race-observation", (_req, res) => res.json(observation));
app.use(createApp());
const server = app.listen(5184, "127.0.0.1", () => {
  console.log("Compile race verification: http://127.0.0.1:5184");
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit());
  });
