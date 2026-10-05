import { describe, expect, it, vi } from "vitest";
import request from "supertest";

const lpush = vi.fn().mockResolvedValue(1);
const ping = vi.fn().mockResolvedValue("PONG");
vi.mock("../src/redis.js", () => ({
  VOTE_QUEUE_KEY: "music:votes",
  getRedisClient: () => ({ lpush, ping }),
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
  it("returns ok with a version string", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.version).toBe("string");
  });
});

describe("GET /metrics", () => {
  it("exposes Prometheus-format metrics including votes_received_total", async () => {
    const app = createApp();
    await request(app).post("/api/v1/votes").send({ songId: 1, rating: 5, userId: validUserId });

    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("votes_received_total");
    expect(res.text).toContain('result="accepted"');
    expect(res.text).toContain("http_request_duration_seconds");
  });
});

describe("GET /ready", () => {
  it("returns 200 when Redis is reachable", async () => {
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
  });

  it("returns 503 when Redis is unreachable", async () => {
    ping.mockRejectedValueOnce(new Error("connection refused"));
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
  });
});
