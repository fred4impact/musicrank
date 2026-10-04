import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

/** Inserts votes directly (bypassing the worker, which isn't under test here) and refreshes song_statistics. */
export async function seedVotes(pool: Pool, songId: number, ratings: number[], createdAt?: Date) {
  for (const rating of ratings) {
    const userId = randomUUID();
    await pool.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [userId]);
    await pool.query(
      `INSERT INTO votes (event_id, user_id, song_id, rating, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, now()), COALESCE($5, now()))`,
      [`evt-${randomUUID()}`, userId, songId, rating, createdAt ?? null]
    );
  }
  await pool.query(
    `INSERT INTO song_statistics (song_id, vote_count, average_rating, ranking_score, updated_at)
     SELECT song_id, COUNT(*), AVG(rating), AVG(rating), now()
     FROM votes WHERE song_id = $1
     GROUP BY song_id
     ON CONFLICT (song_id) DO UPDATE SET
       vote_count = EXCLUDED.vote_count,
       average_rating = EXCLUDED.average_rating,
       updated_at = now()`,
    [songId]
  );
}

export async function resetSong(pool: Pool, songId: number) {
  await pool.query("DELETE FROM votes WHERE song_id = $1", [songId]);
  await pool.query(
    "UPDATE song_statistics SET vote_count = 0, average_rating = 0, ranking_score = 0 WHERE song_id = $1",
    [songId]
  );
}
