import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { VOTE_QUEUE_KEY } from "./redis.js";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const votesProcessedTotal = new Counter({
  name: "votes_processed_total",
  help: "Vote events consumed from Redis, by outcome",
  labelNames: ["outcome"], // processed | duplicate | invalid | permanent_failure | requeued
  registers: [registry],
});

export const voteProcessingDurationSeconds = new Histogram({
  name: "vote_processing_duration_seconds",
  help: "Time to apply one vote event to Postgres",
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [registry],
});

/** Gauge reads Redis's actual queue length at scrape time rather than being tracked by hand in the hot path. */
export function registerQueueSizeMetric(redis: Redis) {
  new Gauge({
    name: "redis_vote_queue_size",
    help: "Pending vote events in the Redis queue",
    registers: [registry],
    async collect() {
      this.set(await redis.llen(VOTE_QUEUE_KEY));
    },
  });
}

export function registerPoolMetrics(pool: Pool) {
  new Gauge({
    name: "db_pool_total_connections",
    help: "Total Postgres connections currently held by the pool",
    registers: [registry],
    collect() {
      this.set(pool.totalCount);
    },
  });
  new Gauge({
    name: "db_pool_idle_connections",
    help: "Idle Postgres connections currently held by the pool",
    registers: [registry],
    collect() {
      this.set(pool.idleCount);
    },
  });
}
