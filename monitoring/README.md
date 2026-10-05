# monitoring

Prometheus + Grafana, giving the system the operational visibility spec §28
asks for. Deployed into the same `musicrank` namespace as the app.

## What's here

- **`prometheus/rbac.yaml`** — read-only ServiceAccount/ClusterRole letting
  Prometheus discover scrape targets via the Kubernetes API.
- **`prometheus/configmap.yaml`** — scrape config. Auto-discovers any pod
  annotated `prometheus.io/scrape: "true"` (see `kubernetes/{vote-api,
  ranking-api,worker}/deployment.yaml`'s pod template annotations) — no
  hand-maintained target list, and no Prometheus Operator/ServiceMonitor
  CRDs either, which would be real overkill for 3 app services.
- **`prometheus/kube-state-metrics.yaml`** — standard component exposing
  Kubernetes object state (pod restarts, deployment replica counts) as
  metrics. Specifically what satisfies spec §28's "Pod restarts" — no
  application can report that about itself, since it's a fact about the
  cluster, not the process.
- **`prometheus/deployment.yaml`** — Prometheus itself. `emptyDir` for
  TSDB storage, not a PVC — metrics history resets on pod recreation,
  deliberately: unlike Postgres's PVC (protecting real data), long-term
  retention isn't the point of this demo.
- **`grafana/`** — Grafana, with the Prometheus datasource and the
  `musicrank-dashboard.json` dashboard both provisioned on boot (no
  manual click-through setup). Anonymous viewer access is enabled for
  local convenience — see the deployment manifest's comment on what a
  real deployment should do instead.

## What's on the dashboard

Four rows, covering every metric spec §28 explicitly lists as useful,
short of the ones needing tracing/alerting infrastructure this project
doesn't have (out of scope — see root README's Status):

- **HTTP** — request rate, 5xx error rate, p95 latency (vote-api + ranking-api)
- **Voting pipeline** — votes received (by outcome), votes processed (by
  outcome), Redis queue depth, p95 vote-processing time
- **Resources** — CPU/memory by pod, Postgres connection pool state
- **Kubernetes** — pod restarts, ready replicas per Deployment (from
  kube-state-metrics)

## Deploy

```bash
kubectl apply -f monitoring/prometheus/rbac.yaml \
  -f monitoring/prometheus/kube-state-metrics.yaml \
  -f monitoring/prometheus/configmap.yaml \
  -f monitoring/prometheus/deployment.yaml

kubectl apply -f monitoring/grafana/configmap-datasource.yaml \
  -f monitoring/grafana/configmap-dashboard-provider.yaml \
  -f monitoring/grafana/configmap-dashboard.yaml \
  -f monitoring/grafana/deployment.yaml
```

## URLs

| Service | URL |
|---|---|
| Grafana | http://localhost:3000 (anonymous viewer access, no login needed) |
| Prometheus | http://localhost:9090 |

## Verified

- Every app pod shows up in Prometheus's target list as `up` (`/api/v1/targets`).
- Real votes submitted through the live cluster show up in Prometheus
  within one scrape interval (`votes_received_total`, `votes_processed_total`),
  correctly split across whichever replica actually handled each request —
  confirms the per-pod annotation-based discovery is scraping every
  replica individually, not just one.
- The dashboard JSON is valid and loads into Grafana with all 16 panels
  correctly positioned (checked via `GET /api/dashboards/uid/musicrank`).
- Grafana's datasource proxy successfully executes a real query against
  Prometheus through the exact path a panel uses
  (`/api/datasources/proxy/uid/prometheus/...`).
- Found and fixed a real bug this way: the worker's liveness probe
  (added for the new `/metrics` endpoint) used Kubernetes' default 1s
  probe timeout, which was occasionally too tight for an endpoint doing
  an async Redis call under concurrent scrape load from both Prometheus
  and the kubelet — caused a restart loop with no actual error in the
  logs, just probe timeouts. Fixed with `timeoutSeconds: 5`.
