import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { paginationSchema } from "../pagination.js";
import { sendError } from "../errors.js";

const listQuerySchema = paginationSchema.extend({
  genre: z.string().trim().min(1).optional(),
});

const SONG_SELECT = `
  SELECT
    s.id, s.title, s.album, s.release_date, s.duration_seconds, s.cover_image_url,
    a.id AS artist_id, a.name AS artist_name,
    g.id AS genre_id, g.name AS genre_name,
    ss.vote_count, ss.average_rating
  FROM songs s
  JOIN artists a ON a.id = s.artist_id
  LEFT JOIN genres g ON g.id = s.genre_id
  LEFT JOIN song_statistics ss ON ss.song_id = s.id
`;

function toSongDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    album: row.album,
    releaseDate: row.release_date,
    durationSeconds: row.duration_seconds,
    coverImageUrl: row.cover_image_url,
    artist: { id: row.artist_id, name: row.artist_name },
    genre: row.genre_id ? { id: row.genre_id, name: row.genre_name } : null,
    rating: row.average_rating ? Number(row.average_rating) : 0,
    votes: row.vote_count ?? 0,
  };
}

export function songsRouter(pool: Pool) {
  const router = Router();

  router.get("/songs", async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_QUERY", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { limit, offset, genre } = parsed.data;

    const result = genre
      ? await pool.query(`${SONG_SELECT} WHERE g.name = $3 ORDER BY s.id LIMIT $1 OFFSET $2`, [
          limit,
          offset,
          genre,
        ])
      : await pool.query(`${SONG_SELECT} ORDER BY s.id LIMIT $1 OFFSET $2`, [limit, offset]);

    res.status(200).json({ songs: result.rows.map(toSongDto) });
  });

  router.get("/songs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, "INVALID_SONG_ID", "songId must be a positive integer.");
    }

    const result = await pool.query(`${SONG_SELECT} WHERE s.id = $1`, [id]);
    if (result.rows.length === 0) {
      return sendError(res, 404, "SONG_NOT_FOUND", "The requested song does not exist.");
    }

    res.status(200).json(toSongDto(result.rows[0]));
  });

  return router;
}
