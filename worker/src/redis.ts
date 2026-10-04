import { Redis } from "ioredis";

export const VOTE_QUEUE_KEY = "music:votes";

export function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, { maxRetriesPerRequest: null });
}
