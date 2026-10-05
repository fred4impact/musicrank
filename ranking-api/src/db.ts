import pg from "pg";

const { Pool } = pg;

export function createPool(): pg.Pool {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://musicrank:musicrank@localhost:5432/musicrank",
  });

  // pg.Pool emits 'error' when an idle client's connection is dropped (e.g.
  // Postgres restarting). With no listener, Node's default EventEmitter
  // behavior for an unhandled 'error' event is to throw and crash the whole
  // process — observed this for real while testing Kubernetes pod recovery
  // (a brief Postgres outage took down every ranking-api replica at once,
  // rather than just failing in-flight queries until the pool reconnects).
  pool.on("error", (err) => {
    console.error("ranking-api: idle Postgres client error (pool will reconnect)", err);
  });

  return pool;
}
