import type { Pool } from "pg";
import type { VoteEvent } from "./types.js";

export type ProcessResult = "processed" | "duplicate";

/** Thrown for errors that will never succeed on retry (bad songId, etc). Caller should drop, not requeue. */
export class PermanentProcessingError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message);
    this.name = "PermanentProcessingError";
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Applies one vote event to Postgres. Per spec §8: validate (caller's job) ->
 * check duplicate -> insert vote -> update song statistics -> commit.
 *
 * Dedup is keyed on event_id (idempotent redelivery), but the "one vote per
 * song, latest wins" business rule (spec §26) is keyed on (user_id, song_id)
 * — a user re-voting produces a *different* event_id for the *same* row, so
 * event_id alone can't be the upsert target. We check event_id first (cheap
 * short-circuit for exact-event redelivery), then upsert on (user_id, song_id).
 *
 * There is no anonymous-user registration step in V1 (see migration header),
 * so the user row is lazily created here on first vote.
 */
export async function processVoteEvent(pool: Pool, event: VoteEvent): Promise<ProcessResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT 1 FROM votes WHERE event_id = $1", [
      event.eventId,
    ]);
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return "duplicate";
    }

    await client.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
      event.userId,
    ]);

    await client.query(
      `INSERT INTO votes (event_id, user_id, song_id, rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, song_id)
       DO UPDATE SET event_id = EXCLUDED.event_id, rating = EXCLUDED.rating, updated_at = now()`,
      [event.eventId, event.userId, event.songId, event.rating]
    );

    // Recomputed from source-of-truth votes rather than incremented, so a
    // rating change (UPDATE above) is reflected correctly, not double-counted.
    // ranking_score is a placeholder equal to average_rating for now — the
    // real weighted formula (spec §12 v2) is a Ranking API/Phase 3 concern.
    await client.query(
      `INSERT INTO song_statistics (song_id, vote_count, average_rating, ranking_score, updated_at)
       SELECT song_id, COUNT(*), AVG(rating), AVG(rating), now()
       FROM votes WHERE song_id = $1
       GROUP BY song_id
       ON CONFLICT (song_id) DO UPDATE SET
         vote_count = EXCLUDED.vote_count,
         average_rating = EXCLUDED.average_rating,
         ranking_score = EXCLUDED.ranking_score,
         updated_at = now()`,
      [event.songId]
    );

    await client.query("COMMIT");
    return "processed";
  } catch (err) {
    await client.query("ROLLBACK");
    if (isForeignKeyViolation(err)) {
      throw new PermanentProcessingError(
        `Vote references a song/user that does not exist: songId=${event.songId}`,
        err
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === FOREIGN_KEY_VIOLATION;
}
