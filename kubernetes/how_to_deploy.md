# How to deploy MusicRank to Kubernetes

Every command used to get from nothing to the full system running on
Kubernetes, in the order it actually has to happen. Tested against Docker
Desktop's built-in Kubernetes — see `README.md`'s "Local prerequisites" for
why, and for the minikube/kind alternative.

Each stage depends on the ones before it. Don't skip ahead.

---

## Stage 0 — Prerequisites

```bash
# Confirm Docker Desktop's Kubernetes is the active context
kubectl config use-context docker-desktop
kubectl cluster-info
kubectl get nodes
```

You should see one `Ready` node (`desktop-control-plane`).

---

## Stage 1 — Build and tag the application images

Kubernetes pulls images by name+tag. Docker Desktop's cluster shares the
host's Docker image store, so a local `docker build`/`docker compose build`
is immediately usable — no registry push needed for local dev.

```bash
cd /path/to/MusicRank

# Build all 4 application images via their Dockerfiles
docker compose build vote-api ranking-api worker frontend
```

**Then tag each with the exact version its manifest references — do not
skip this.** Every manifest pins an explicit tag, not `:latest`. This is
deliberate: with `imagePullPolicy: IfNotPresent`, rebuilding an image's
*contents* without changing its tag gives Kubernetes nothing to diff, so a
later `kubectl apply` silently does nothing even though the image changed
(found this the hard way during Phase 6 — see `README.md`'s CI/CD section).

```bash
docker tag musicrank-vote-api:latest     musicrank-vote-api:v0.3.0
docker tag musicrank-ranking-api:latest  musicrank-ranking-api:0.2.0
docker tag musicrank-worker:latest       musicrank-worker:0.2.0
docker tag musicrank-frontend:latest     musicrank-frontend:0.0.0
```

These tags must match whatever's currently in each
`kubernetes/<service>/deployment.yaml`'s `image:` line — check with:

```bash
grep -rn "image: musicrank" kubernetes/*/deployment.yaml
```

If you've actually changed a service's code: bump its `package.json`
version, build with that new tag, update the `image:` line in its
Deployment manifest to match, *then* continue to Stage 3. A mismatched tag
is the single most common way this deployment silently serves stale code.

---

## Stage 2 — Namespace, config, and secrets

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
```

**First time only** — create the real secrets file (gitignored, never
commit it):

```bash
cp kubernetes/secrets.example.yaml kubernetes/secrets.yaml
# edit kubernetes/secrets.yaml with real values
```

```bash
kubectl apply -f kubernetes/secrets.yaml
```

**Never run a recursive `kubectl apply -f kubernetes/ -R`.** Both
`secrets.yaml` and `secrets.example.yaml` define the same Secret
(`musicrank-secrets`); a directory glob applies both, and whichever
`kubectl` processes last silently overwrites the other. Apply `secrets.yaml`
by itself, explicitly, every time.

---

## Stage 3 — Infrastructure: Postgres and Redis

```bash
kubectl apply -f kubernetes/postgres/ -f kubernetes/redis/
```

This also creates `musicrank-postgres-init` (a ConfigMap wrapping
`database/migrations/0001_init.sql` and `database/seed/seed.sql`, mounted
at `/docker-entrypoint-initdb.d` — Postgres runs it automatically, but only
on a pod's **first** boot against an empty PersistentVolumeClaim). Wait for
both before continuing:

```bash
kubectl rollout status statefulset/postgres -n musicrank --timeout=90s
kubectl rollout status deployment/redis -n musicrank --timeout=60s
```

Confirm the schema + seed actually ran:

```bash
kubectl logs -n musicrank postgres-0 | grep -E "CREATE|INSERT"
# expect: CREATE TABLE x6, CREATE INDEX x4, then INSERT 0 6 / 0 8 / 0 20 / 0 20
```

If `kubernetes/postgres/configmap-init.yaml`'s source SQL files ever
change, regenerate it first (command is in that file's own header comment)
before this stage, or the new pod will seed stale data.

---

## Stage 4 — Application services

```bash
kubectl apply -f kubernetes/vote-api/ -f kubernetes/ranking-api/ \
  -f kubernetes/worker/ -f kubernetes/frontend/
```

```bash
kubectl rollout status deployment/vote-api -n musicrank --timeout=90s
kubectl rollout status deployment/ranking-api -n musicrank --timeout=90s
kubectl rollout status deployment/worker -n musicrank --timeout=90s
kubectl rollout status deployment/frontend -n musicrank --timeout=90s
```

### Verify

```bash
kubectl get pods -n musicrank
```

All pods should read `1/1 Running`, `0` restarts. Docker Desktop's
LoadBalancer implementation binds `type: LoadBalancer` Services straight to
`localhost`:

```bash
curl -s http://localhost:5173/                              # frontend -> 200
curl -s http://localhost:4001/health                         # vote-api
curl -s http://localhost:4001/ready                           # checks Redis
curl -s http://localhost:4002/health                         # ranking-api
curl -s http://localhost:4002/ready                           # checks Postgres
curl -s "http://localhost:4002/api/v1/rankings/global?limit=3"  # real seeded data
```

Postgres (`localhost:5432`) and Redis (`localhost:6379`) are `ClusterIP` —
intentionally **not** reachable from the host (spec §18). Use
`kubectl exec`/`port-forward` to reach them directly if you need to.

---

## Stage 5 — Monitoring (Prometheus + Grafana)

Optional, but Stage 4 must be applied first — Prometheus discovers app
pods via annotations already present on their Deployments.

```bash
kubectl apply -f monitoring/prometheus/rbac.yaml \
  -f monitoring/prometheus/kube-state-metrics.yaml \
  -f monitoring/prometheus/configmap.yaml \
  -f monitoring/prometheus/deployment.yaml
```

```bash
kubectl rollout status deployment/kube-state-metrics -n musicrank --timeout=60s
kubectl rollout status deployment/prometheus -n musicrank --timeout=60s
```

```bash
kubectl apply -f monitoring/grafana/configmap-datasource.yaml \
  -f monitoring/grafana/configmap-dashboard-provider.yaml \
  -f monitoring/grafana/configmap-dashboard.yaml \
  -f monitoring/grafana/deployment.yaml
```

```bash
kubectl rollout status deployment/grafana -n musicrank --timeout=60s
```

### Verify

```bash
# Every app pod should show health "up"
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json, sys
for t in json.load(sys.stdin)['data']['activeTargets']:
    print(t['labels'].get('job'), t['labels'].get('app', t['labels'].get('instance')), t['health'])
"

# Dashboard loaded with all 16 panels
curl -s "http://localhost:3000/api/dashboards/uid/musicrank" | python3 -c "
import json, sys
print(len(json.load(sys.stdin)['dashboard']['panels']), 'panels')
"
```

Grafana: http://localhost:3000 (anonymous viewer access, dashboard
**MusicRank**). Prometheus: http://localhost:9090.

---

## Full deploy, start to finish (copy-paste block)

```bash
kubectl config use-context docker-desktop

docker compose build vote-api ranking-api worker frontend
docker tag musicrank-vote-api:latest     musicrank-vote-api:v0.3.0
docker tag musicrank-ranking-api:latest  musicrank-ranking-api:0.2.0
docker tag musicrank-worker:latest       musicrank-worker:0.2.0
docker tag musicrank-frontend:latest     musicrank-frontend:0.0.0

kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml   # after first-time setup — see Stage 2

kubectl apply -f kubernetes/postgres/ -f kubernetes/redis/
kubectl rollout status statefulset/postgres -n musicrank --timeout=90s
kubectl rollout status deployment/redis -n musicrank --timeout=60s

kubectl apply -f kubernetes/vote-api/ -f kubernetes/ranking-api/ \
  -f kubernetes/worker/ -f kubernetes/frontend/
kubectl rollout status deployment/vote-api -n musicrank --timeout=90s
kubectl rollout status deployment/ranking-api -n musicrank --timeout=90s
kubectl rollout status deployment/worker -n musicrank --timeout=90s
kubectl rollout status deployment/frontend -n musicrank --timeout=90s

kubectl apply -f monitoring/prometheus/rbac.yaml \
  -f monitoring/prometheus/kube-state-metrics.yaml \
  -f monitoring/prometheus/configmap.yaml \
  -f monitoring/prometheus/deployment.yaml
kubectl apply -f monitoring/grafana/configmap-datasource.yaml \
  -f monitoring/grafana/configmap-dashboard-provider.yaml \
  -f monitoring/grafana/configmap-dashboard.yaml \
  -f monitoring/grafana/deployment.yaml
kubectl rollout status deployment/prometheus -n musicrank --timeout=60s
kubectl rollout status deployment/grafana -n musicrank --timeout=60s

kubectl get pods -n musicrank
```

---

## Updating a running deployment (after a code change)

```bash
# 1. Bump the service's package.json version
# 2. Rebuild + tag with the new version
docker build -t musicrank-<service>:<new-version> ./<service>

# 3. Update kubernetes/<service>/deployment.yaml's image: line to match
# 4. Apply — this triggers a real rolling update (maxUnavailable/maxSurge: 1)
kubectl apply -f kubernetes/<service>/
kubectl rollout status deployment/<service> -n musicrank --timeout=60s
```

---

## Shutting down for the day (without losing anything)

Scales every workload to zero — no running pods, no compute cost — while
keeping the namespace, all manifests/config, the Postgres PVC, and the
Grafana dashboard provisioning completely intact. No redeploy needed
tomorrow, just a scale back up.

```bash
kubectl scale deployment --all --replicas=0 -n musicrank
kubectl scale statefulset postgres --replicas=0 -n musicrank
```

Resume:

```bash
kubectl scale statefulset postgres --replicas=1 -n musicrank
kubectl scale deployment redis --replicas=1 -n musicrank
kubectl rollout status statefulset/postgres -n musicrank --timeout=90s

kubectl scale deployment vote-api --replicas=3 -n musicrank
kubectl scale deployment ranking-api --replicas=3 -n musicrank
kubectl scale deployment worker --replicas=3 -n musicrank
kubectl scale deployment frontend --replicas=3 -n musicrank
kubectl scale deployment prometheus --replicas=1 -n musicrank
kubectl scale deployment grafana --replicas=1 -n musicrank
kubectl scale deployment kube-state-metrics --replicas=1 -n musicrank
```

## Tearing down completely

```bash
kubectl delete namespace musicrank

# ClusterRole/ClusterRoleBinding are cluster-scoped, not namespaced — the
# namespace delete above does NOT remove these, they'd be orphaned
# otherwise (confirmed by checking `kubectl get clusterrole,clusterrolebinding`
# after a namespace delete — they're still there).
kubectl delete clusterrole prometheus kube-state-metrics
kubectl delete clusterrolebinding prometheus kube-state-metrics
```

The namespace delete removes everything namespaced, **including the
Postgres PVC — all data is lost.** Only the manifests on disk and (if you
ran Stage 1) the locally-built Docker images survive. A fresh
`kubectl apply` from Stage 2 onward rebuilds from the seed data again, not
from whatever was in the database.

---

## Troubleshooting notes (things that actually went wrong while building this)

- **Pods stuck `Pending`/`ContainerCreating` referencing a `musicrank-*`
  image**: the tag in the Deployment doesn't match any image Docker
  actually has. Re-run Stage 1's `docker tag` commands and confirm with
  `docker images | grep musicrank`.
- **A rolling update doesn't seem to do anything** (`kubectl apply`
  succeeds, `kubectl rollout status` returns instantly, no new pods):
  you rebuilt an image without changing its tag. Kubernetes only acts on a
  manifest diff — see Stage 1's note on `:latest`.
- **`ranking-api`/`worker` crash shortly after a Postgres disruption**
  (not a fresh-install problem — only if you've manually killed/scaled
  Postgres while the app was running): fixed in `db.ts` via
  `pool.on("error", ...)` as of the Phase 8 commit. If you see it on an
  older image, rebuild.
- **Worker pods restart repeatedly after the monitoring stack goes in**:
  check `kubectl describe pod <worker-pod> -n musicrank` for `Liveness
  probe failed: ... context deadline exceeded`. The probe's
  `timeoutSeconds` needs to be at least `5` (already set in the committed
  manifest) — the default `1s` is too tight for `/metrics`' async Redis
  call under concurrent scrape load.
- **Can't reach Postgres/Redis from your host machine directly**: expected
  — both are `ClusterIP` (spec §18, intentionally not host-reachable).
  `kubectl port-forward svc/postgres 5432:5432 -n musicrank` if you need
  direct `psql` access for debugging.
