import { createRedisClient, VOTE_QUEUE_KEY } from "./redis.js";
import { createPool } from "./db.js";
import { voteEventSchema } from "./types.js";
import { processVoteEvent, PermanentProcessingError } from "./processVote.js";

const BRPOP_TIMEOUT_SECONDS = 5;
const REQUEUE_DELAY_MS = 1000;

const redis = createRedisClient();
const pool = createPool();

let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`worker: received ${signal}, finishing current item then exiting`);
    running = false;
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop() {
  console.log("worker: listening on", VOTE_QUEUE_KEY);
  while (running) {
    const popped = await redis.brpop(VOTE_QUEUE_KEY, BRPOP_TIMEOUT_SECONDS);
    if (!popped) continue; // timed out, loop again (lets the shutdown flag be checked)

    const [, raw] = popped;
    await handleMessage(raw);
  }
  await pool.end();
  redis.disconnect();
  console.log("worker: shut down cleanly");
}

async function handleMessage(raw: string) {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    console.error("worker: dropping unparseable message:", raw);
    return;
  }

  const result = voteEventSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error("worker: dropping invalid event:", result.error.issues, raw);
    return;
  }

  const event = result.data;
  try {
    const outcome = await processVoteEvent(pool, event);
    if (outcome === "duplicate") {
      console.log(`worker: skipped duplicate event ${event.eventId}`);
    } else {
      console.log(`worker: processed vote ${event.eventId} (song ${event.songId}, rating ${event.rating})`);
    }
  } catch (err) {
    if (err instanceof PermanentProcessingError) {
      console.error(`worker: permanent failure, dropping event ${event.eventId}:`, err.message);
      return;
    }
    console.error(`worker: transient failure processing ${event.eventId}, requeuing:`, err);
    await sleep(REQUEUE_DELAY_MS);
    await redis.lpush(VOTE_QUEUE_KEY, raw);
  }
}

runLoop().catch((err) => {
  console.error("worker: fatal error", err);
  process.exit(1);
});
