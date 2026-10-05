import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDurationSeconds.observe(labels, seconds);
  });
  next();
}

/** Registers gauges that read the pg Pool's live counts at scrape time, rather than tracking them by hand. */
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
  new Gauge({
    name: "db_pool_waiting_requests",
    help: "Queries waiting for a free connection",
    registers: [registry],
    collect() {
      this.set(pool.waitingCount);
    },
  });
}
