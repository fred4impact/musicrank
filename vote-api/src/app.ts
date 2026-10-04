import cors from "cors";
import express from "express";
import { getRedisClient } from "./redis.js";
import { votesRouter } from "./routes/votes.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
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
