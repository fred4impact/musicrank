import cors from "cors";
import express from "express";
// Patches Express 4 so a thrown/rejected error inside an async route handler
// reaches the error middleware below instead of hanging the request —
// Express 4 does not do this natively (Express 5 will, but isn't used here).
import "express-async-errors";
import type { Pool } from "pg";
import { rankingsRouter } from "./routes/rankings.js";
import { songsRouter } from "./routes/songs.js";
import { artistsRouter } from "./routes/artists.js";
import { genresRouter } from "./routes/genres.js";

export function createApp(pool: Pool) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1", rankingsRouter(pool));
  app.use("/api/v1", songsRouter(pool));
  app.use("/api/v1", artistsRouter(pool));
  app.use("/api/v1", genresRouter(pool));

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "The requested route does not exist." },
    });
  });

  // Catches errors thrown by async route handlers (e.g. a dropped DB
  // connection) so a query failure returns 500 + the spec's error shape
  // instead of crashing the process or hanging the request.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("ranking-api: unhandled error", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong processing this request." },
    });
  });

  return app;
}
