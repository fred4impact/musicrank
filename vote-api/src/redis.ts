import { Redis } from "ioredis";

export const VOTE_QUEUE_KEY = "music:votes";

let client: Redis | undefined;

export function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    client = new Redis(url);
  }
  return client;
}
