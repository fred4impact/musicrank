// Integration test — needs the real Postgres container from docker-compose
// (docker compose up -d postgres), migrated and seeded. Per spec §30, this is
// deliberately not mocked: the logic being tested is the SQL itself.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPool } from "../src/db.js";
import { processVoteEvent, PermanentProcessingError } from "../src/processVote.js";
import type { VoteEvent } from "../src/types.js";

const pool = createPool();

// Seeded song id 1 ("Midnight Frequency") from database/seed/seed.sql.
const SEEDED_SONG_ID = 1;
const NONEXISTENT_SONG_ID = 999999;

function makeEvent(overrides: Partial<VoteEvent> = {}): VoteEvent {
  return {
    eventId: `evt-${randomUUID()}`,
    userId: randomUUID(),
    songId: SEEDED_SONG_ID,
    rating: 5,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

async function statsFor(songId: number) {
  const res = await pool.query(
    "SELECT vote_count, average_rating FROM song_statistics WHERE song_id = $1",
    [songId]
  );
  return res.rows[0] as { vote_count: number; average_rating: string } | undefined;
}

beforeEach(async () => {
  await pool.query("DELETE FROM votes WHERE song_id IN ($1, $2)", [SEEDED_SONG_ID, NONEXISTENT_SONG_ID]);
  await pool.query(
    "INSERT INTO song_statistics (song_id, vote_count, average_rating, ranking_score) VALUES ($1, 0, 0, 0) ON CONFLICT (song_id) DO UPDATE SET vote_count = 0, average_rating = 0, ranking_score = 0",
    [SEEDED_SONG_ID]
  );
});

afterAll(async () => {
  await pool.end();
});

describe("processVoteEvent", () => {
  it("inserts a new vote and updates song_statistics", async () => {
    const event = makeEvent({ rating: 4 });
    const result = await processVoteEvent(pool, event);

    expect(result).toBe("processed");
    const stats = await statsFor(SEEDED_SONG_ID);
    expect(stats?.vote_count).toBe(1);
    expect(Number(stats?.average_rating)).toBe(4);
  });

  it("is idempotent for a replayed event_id", async () => {
    const event = makeEvent({ rating: 5 });
    await processVoteEvent(pool, event);
    const second = await processVoteEvent(pool, event);

    expect(second).toBe("duplicate");
    const stats = await statsFor(SEEDED_SONG_ID);
    expect(stats?.vote_count).toBe(1); // not double-counted
  });

  it("updates (not duplicates) when the same user votes again with a new event_id", async () => {
    const userId = randomUUID();
    await processVoteEvent(pool, makeEvent({ userId, rating: 2 }));
    await processVoteEvent(pool, makeEvent({ userId, rating: 5 }));

    const stats = await statsFor(SEEDED_SONG_ID);
    expect(stats?.vote_count).toBe(1); // still one row for this user+song
    expect(Number(stats?.average_rating)).toBe(5); // reflects the latest rating

    const votes = await pool.query("SELECT rating FROM votes WHERE user_id = $1", [userId]);
    expect(votes.rows).toHaveLength(1);
  });

  it("averages correctly across multiple distinct users", async () => {
    await processVoteEvent(pool, makeEvent({ rating: 2 }));
    await processVoteEvent(pool, makeEvent({ rating: 4 }));

    const stats = await statsFor(SEEDED_SONG_ID);
    expect(stats?.vote_count).toBe(2);
    expect(Number(stats?.average_rating)).toBe(3);
  });

  it("throws PermanentProcessingError for a non-existent songId", async () => {
    const event = makeEvent({ songId: NONEXISTENT_SONG_ID });
    await expect(processVoteEvent(pool, event)).rejects.toBeInstanceOf(PermanentProcessingError);
  });

  it("lazily creates the anonymous user row on first vote", async () => {
    const userId = randomUUID();
    await processVoteEvent(pool, makeEvent({ userId }));

    const user = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    expect(user.rows).toHaveLength(1);
  });
});
