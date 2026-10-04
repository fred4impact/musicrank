import { Router } from "express";
import type { Pool } from "pg";
import { paginationSchema } from "../pagination.js";
import { sendError } from "../errors.js";

export function rankingsRouter(pool: Pool) {
  const router = Router();

  // Global ranking uses a Bayesian-weighted score, not a raw average, per
  // spec §12's explicit requirement: "a song with only one vote should not
  // automatically dominate a song with thousands of votes." BAYESIAN_MIN_VOTES
  // is the "confidence" constant — a song's score is pulled toward the global
  // mean until it has roughly this many votes. song_statistics.ranking_score
  // (written by the worker) is a simple placeholder, not used for ordering
  // here, since this formula needs the global mean at query time.
  const BAYESIAN_MIN_VOTES = 5;

  router.get("/rankings/global", async (req, res) => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_QUERY", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { limit, offset } = parsed.data;

    const result = await pool.query(
      `WITH global AS (
         SELECT COALESCE(AVG(rating), 0) AS global_avg FROM votes
       )
       SELECT
         s.id AS song_id,
         s.title,
         a.name AS artist,
         ss.vote_count,
         (
           (ss.vote_count::numeric / (ss.vote_count + $3)) * ss.average_rating
           + ($3::numeric / (ss.vote_count + $3)) * global.global_avg
         ) AS score
       FROM song_statistics ss
       JOIN songs s ON s.id = ss.song_id
       JOIN artists a ON a.id = s.artist_id
       CROSS JOIN global
       ORDER BY score DESC, ss.vote_count DESC, s.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset, BAYESIAN_MIN_VOTES]
    );

    res.status(200).json({
      ranking: result.rows.map((row, i) => ({
        position: offset + i + 1,
        songId: row.song_id,
        title: row.title,
        artist: row.artist,
        score: Number(Number(row.score).toFixed(3)),
        votes: row.vote_count,
      })),
    });
  });

  // First-pass trending per spec §13: recent vote activity in the last 24h.
  router.get("/rankings/trending", async (req, res) => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_QUERY", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { limit, offset } = parsed.data;

    const result = await pool.query(
      `SELECT
         s.id AS song_id,
         s.title,
         a.name AS artist,
         ss.vote_count,
         ss.average_rating,
         COUNT(v.id) FILTER (WHERE v.created_at >= now() - interval '24 hours') AS recent_votes
       FROM songs s
       JOIN artists a ON a.id = s.artist_id
       JOIN song_statistics ss ON ss.song_id = s.id
       LEFT JOIN votes v ON v.song_id = s.id
       GROUP BY s.id, s.title, a.name, ss.vote_count, ss.average_rating
       ORDER BY recent_votes DESC, ss.average_rating DESC, s.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      ranking: result.rows.map((row, i) => ({
        position: offset + i + 1,
        songId: row.song_id,
        title: row.title,
        artist: row.artist,
        score: Number(row.recent_votes),
        votes: row.vote_count,
      })),
    });
  });

  return router;
}
