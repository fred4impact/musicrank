// Integration tests against the real Postgres container (see worker's test
// suite for the same rationale) — needs docker compose up -d postgres,
// migrated and seeded.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { resetSong, seedVotes } from "./helpers.js";

const pool = createPool();
const app = createApp(pool);

// Seeded ids from database/seed/seed.sql (now deterministic — see seq column).
const SONG_A = 1; // Midnight Frequency
const SONG_B = 2; // Reckless Weather
const BASELINE_SONGS = [3, 4, 5, 6, 7]; // establishes a realistic global mean for the Bayesian test below
const ALL_TEST_SONGS = [SONG_A, SONG_B, ...BASELINE_SONGS];

beforeEach(async () => {
  for (const id of ALL_TEST_SONGS) await resetSong(pool, id);
});

afterAll(async () => {
  for (const id of ALL_TEST_SONGS) await resetSong(pool, id);
  await pool.end();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /metrics", () => {
  it("exposes Prometheus-format metrics including db pool gauges", async () => {
    await request(app).get("/api/v1/genres"); // generate at least one HTTP metric sample
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("http_request_duration_seconds");
    expect(res.text).toContain("db_pool_total_connections");
  });
});

describe("GET /ready", () => {
  it("returns 200 when Postgres is reachable", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/genres", () => {
  it("returns the seeded genres", async () => {
    const res = await request(app).get("/api/v1/genres");
    expect(res.status).toBe(200);
    expect(res.body.genres.map((g: { name: string }) => g.name)).toContain("Rock");
  });
});

describe("GET /api/v1/songs", () => {
  it("lists songs with artist/genre/stats joined", async () => {
    const res = await request(app).get("/api/v1/songs?limit=1&offset=0");
    expect(res.status).toBe(200);
    expect(res.body.songs).toHaveLength(1);
    expect(res.body.songs[0]).toMatchObject({ id: 1, title: "Midnight Frequency" });
    expect(res.body.songs[0].artist.name).toBe("The Faded Signals");
  });

  it("filters by genre", async () => {
    const res = await request(app).get("/api/v1/songs?genre=Jazz&limit=50");
    expect(res.status).toBe(200);
    expect(res.body.songs.length).toBeGreaterThan(0);
    for (const song of res.body.songs) {
      expect(song.genre.name).toBe("Jazz");
    }
  });

  it("rejects an out-of-range limit", async () => {
    const res = await request(app).get("/api/v1/songs?limit=1000");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });
});

describe("GET /api/v1/songs/:id", () => {
  it("returns a single song", async () => {
    const res = await request(app).get("/api/v1/songs/1");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Midnight Frequency");
  });

  it("404s for a nonexistent song", async () => {
    const res = await request(app).get("/api/v1/songs/999999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SONG_NOT_FOUND");
  });
});

describe("GET /api/v1/artists/:id", () => {
  it("returns the artist with their songs", async () => {
    const res = await request(app).get("/api/v1/artists/1");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("The Faded Signals");
    expect(res.body.songs.length).toBeGreaterThan(0);
  });

  it("404s for a nonexistent artist", async () => {
    const res = await request(app).get("/api/v1/artists/999999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ARTIST_NOT_FOUND");
  });
});

describe("GET /api/v1/rankings/global", () => {
  it("does not let a single 5-star vote outrank a song with many strong ratings (spec §12)", async () => {
    // Establish a realistic, independent global mean (~3.0) across other
    // songs first — otherwise the global average in the formula is computed
    // only from the two songs under test, which defeats the point of it.
    for (const songId of BASELINE_SONGS) {
      await seedVotes(pool, songId, [3, 3, 2, 4, 3]);
    }
    await seedVotes(pool, SONG_A, [5]); // one vote, perfect score
    await seedVotes(pool, SONG_B, [4, 5, 4, 5, 4, 5, 4, 5, 4, 5]); // ten votes, 4.5 average

    const res = await request(app).get("/api/v1/rankings/global?limit=20");
    expect(res.status).toBe(200);

    const positions = res.body.ranking.reduce(
      (acc: Record<number, number>, row: { songId: number; position: number }) => {
        acc[row.songId] = row.position;
        return acc;
      },
      {}
    );
    expect(positions[SONG_B]).toBeLessThan(positions[SONG_A]);
  });

  it("paginates with position reflecting the offset", async () => {
    const res = await request(app).get("/api/v1/rankings/global?limit=1&offset=1");
    expect(res.status).toBe(200);
    expect(res.body.ranking).toHaveLength(1);
    expect(res.body.ranking[0].position).toBe(2);
  });
});

describe("GET /api/v1/rankings/trending", () => {
  it("counts only votes from the last 24 hours", async () => {
    const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await seedVotes(pool, SONG_A, [5, 4]); // recent
    await seedVotes(pool, SONG_B, [5], yesterday); // stale, shouldn't count

    const res = await request(app).get("/api/v1/rankings/trending?limit=20");
    expect(res.status).toBe(200);

    const bySong = Object.fromEntries(
      res.body.ranking.map((r: { songId: number; score: number }) => [r.songId, r.score])
    );
    expect(bySong[SONG_A]).toBe(2);
    expect(bySong[SONG_B]).toBe(0);
  });
});
