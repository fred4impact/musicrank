import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getRedisClient, VOTE_QUEUE_KEY } from "../redis.js";
import { votesReceivedTotal } from "../metrics.js";
import { voteRequestSchema } from "../validation.js";
import type { VoteEvent } from "../types.js";

export const votesRouter = Router();

votesRouter.post("/votes", async (req, res) => {
  const parsed = voteRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    votesReceivedTotal.inc({ result: "invalid" });
    return res.status(400).json({
      error: {
        code: "INVALID_VOTE_REQUEST",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    });
  }

  const { songId, rating, userId } = parsed.data;
  const event: VoteEvent = {
    eventId: `evt-${randomUUID()}`,
    userId,
    songId,
    rating,
    timestamp: new Date().toISOString(),
  };

  try {
    await getRedisClient().lpush(VOTE_QUEUE_KEY, JSON.stringify(event));
  } catch {
    votesReceivedTotal.inc({ result: "queue_unavailable" });
    return res.status(500).json({
      error: {
        code: "QUEUE_UNAVAILABLE",
        message: "Could not queue the vote for processing. Please try again.",
      },
    });
  }

  votesReceivedTotal.inc({ result: "accepted" });
  return res.status(202).json({
    message: "Vote accepted",
    voteId: event.eventId,
    status: "queued",
  });
});
