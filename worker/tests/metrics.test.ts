import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServer } from "node:http";
import { registry, votesProcessedTotal } from "../src/metrics.js";

// Mirrors metricsServer.ts's handler directly rather than importing
// startMetricsServer (which binds a real port) — supertest works against
// any http.Server/listener, Express or not.
function buildTestServer() {
  return createServer((req, res) => {
    if (req.url === "/metrics") {
      registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { "Content-Type": registry.contentType });
          res.end(body);
        })
        .catch((err: unknown) => {
          res.writeHead(500);
          res.end(String(err));
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

describe("GET /metrics", () => {
  it("exposes Prometheus-format metrics including votes_processed_total", async () => {
    votesProcessedTotal.inc({ outcome: "processed" });

    const res = await request(buildTestServer()).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("votes_processed_total");
    expect(res.text).toContain('outcome="processed"');
    expect(res.text).toContain("vote_processing_duration_seconds");
  });

  it("404s on any other path", async () => {
    const res = await request(buildTestServer()).get("/nope");
    expect(res.status).toBe(404);
  });
});
