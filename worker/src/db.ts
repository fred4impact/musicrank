import pg from "pg";

const { Pool } = pg;

export function createPool(): pg.Pool {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://musicrank:musicrank@localhost:5432/musicrank",
  });
}
