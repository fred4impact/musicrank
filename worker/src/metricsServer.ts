import { createServer } from "node:http";
import { registry } from "./metrics.js";

/**
 * The worker has no API (spec §20's health-check requirement is API-scoped,
 * and it still has none here) — but Prometheus only scrapes over HTTP, so a
 * bare http.Server exposing just /metrics is the minimal way to make this
 * process's counters visible, without turning it into a web service.
 */
export function startMetricsServer(port: number) {
  const server = createServer((req, res) => {
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
  server.listen(port, () => {
    console.log(`worker: metrics server listening on port ${port}`);
  });
  return server;
}
