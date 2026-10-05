import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";
import type { NextFunction, Request, Response } from "express";

export const registry = new Registry();
// CPU, memory, event-loop lag, GC — satisfies spec §28's "CPU usage"/
// "Memory usage" asks without hand-rolling anything.
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

export const votesReceivedTotal = new Counter({
  name: "votes_received_total",
  help: "Votes received by the API, by outcome",
  labelNames: ["result"], // accepted | invalid | queue_unavailable
  registers: [registry],
});

/** Labels routes by their Express pattern (/api/v1/votes), not the raw URL, so metric cardinality stays bounded. */
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
