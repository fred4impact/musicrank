import { readFileSync } from "node:fs";
import cors from "cors";
import express from "express";
import { getRedisClient } from "./redis.js";
import { votesRouter } from "./routes/votes.js";

// Read once at startup rather than per-request. Used to make a rolling
// update observable from the outside (see kubernetes/README.md's Phase 6
// notes) — not required by the spec, just a common, genuinely useful
// practice for a health endpoint.
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", version });
  });

  // See ranking-api's /ready for the same rationale — checks Redis is
  // actually reachable, not just "the process is alive" (spec §20).
  app.get("/ready", async (_req, res) => {
    try {
      await getRedisClient().ping();
      res.status(200).json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not ready" });
    }
  });

  app.use("/api/v1", votesRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "The requested route does not exist." },
    });
  });

  return app;
}
