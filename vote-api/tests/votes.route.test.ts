import { describe, expect, it, vi } from "vitest";
import request from "supertest";

const lpush = vi.fn().mockResolvedValue(1);
vi.mock("../src/redis.js", () => ({
  VOTE_QUEUE_KEY: "music:votes",
  getRedisClient: () => ({ lpush }),
}));

const { createApp } = await import("../src/app.js");

const validUserId = "11111111-1111-1111-1111-111111111111";

describe("POST /api/v1/votes", () => {
  it("queues a valid vote and returns 202", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/votes")
      .send({ songId: 1, rating: 5, userId: validUserId });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ message: "Vote accepted", status: "queued" });
    expect(res.body.voteId).toMatch(/^evt-/);
    expect(lpush).toHaveBeenCalledWith("music:votes", expect.stringContaining('"songId":1'));
  });

  it("rejects an invalid rating with 400 and the spec's error shape", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/votes")
      .send({ songId: 1, rating: 9, userId: validUserId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_VOTE_REQUEST");
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
