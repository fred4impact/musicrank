import { Router } from "express";
import type { Pool } from "pg";
import { sendError } from "../errors.js";

export function artistsRouter(pool: Pool) {
  const router = Router();

  router.get("/artists/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, "INVALID_ARTIST_ID", "artistId must be a positive integer.");
    }

    const artist = await pool.query("SELECT id, name FROM artists WHERE id = $1", [id]);
    if (artist.rows.length === 0) {
      return sendError(res, 404, "ARTIST_NOT_FOUND", "The requested artist does not exist.");
    }

    const songs = await pool.query(
      `SELECT s.id, s.title, ss.vote_count, ss.average_rating
       FROM songs s
       LEFT JOIN song_statistics ss ON ss.song_id = s.id
       WHERE s.artist_id = $1
       ORDER BY s.id`,
      [id]
    );

    res.status(200).json({
      id: artist.rows[0].id,
      name: artist.rows[0].name,
      songs: songs.rows.map((row) => ({
        id: row.id,
        title: row.title,
        rating: row.average_rating ? Number(row.average_rating) : 0,
        votes: row.vote_count ?? 0,
      })),
    });
  });

  return router;
}
