import pg from "pg";

const { Pool } = pg;

export function createPool(): pg.Pool {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://musicrank:musicrank@localhost:5432/musicrank",
  });

  // See ranking-api's db.ts for why this matters — without it, a dropped
  // idle-client connection (e.g. Postgres restarting) crashes the whole
  // process instead of just failing in-flight work until the pool
  // reconnects, which also means a vote getting requeued unnecessarily.
  pool.on("error", (err) => {
    console.error("worker: idle Postgres client error (pool will reconnect)", err);
  });

  return pool;
}
