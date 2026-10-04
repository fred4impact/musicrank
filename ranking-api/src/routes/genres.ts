import { Router } from "express";
import type { Pool } from "pg";

export function genresRouter(pool: Pool) {
  const router = Router();

  router.get("/genres", async (_req, res) => {
    const result = await pool.query("SELECT id, name FROM genres ORDER BY name");
    res.status(200).json({ genres: result.rows });
  });

  return router;
}
