# kubernetes

Manifests for the `musicrank` namespace — namespace, ConfigMap, Secret,
then one Deployment/Service (or StatefulSet for Postgres) per component.

## Local prerequisites

Tested against Docker Desktop's built-in Kubernetes (`kubectl config
use-context docker-desktop`) — minikube/kind work too (spec §3), but you'd
need to load the images into them first (`minikube image load ...` /
`kind load docker-image ...`), since this setup assumes the cluster shares
the host's Docker image store the way Docker Desktop's does.

Build the images first (no registry needed for local dev — see root README),
then tag them to match what the manifests reference (see "Explicit image
tags" below for why `:latest` isn't enough):

```bash
docker compose build vote-api ranking-api worker frontend
docker tag musicrank-vote-api:latest musicrank-vote-api:v0.2.0
docker tag musicrank-ranking-api:latest musicrank-ranking-api:0.1.0
docker tag musicrank-worker:latest musicrank-worker:0.1.0
docker tag musicrank-frontend:latest musicrank-frontend:0.0.0
```

(Those tags match each service's current `package.json` version — bump
both together when you actually change a service.)

## Deploy

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml   # see below — NOT secrets.example.yaml
kubectl apply -f kubernetes/postgres/ -f kubernetes/redis/ \
  -f kubernetes/vote-api/ -f kubernetes/ranking-api/ \
  -f kubernetes/worker/ -f kubernetes/frontend/
```

**Don't run a single recursive `kubectl apply -f kubernetes/ -R`.** Both
`secrets.yaml` and `secrets.example.yaml` define the same Secret
(`musicrank-secrets`) so the directory glob would apply both, and whichever
one `kubectl` processes last wins — silently overwriting your real
credentials with the `changeme` placeholder if the example file sorts
after the real one. Applying `secrets.yaml` by itself, explicitly, avoids
that entirely.

## First-time secret setup

```bash
cp kubernetes/secrets.example.yaml kubernetes/secrets.yaml
# edit kubernetes/secrets.yaml with real values — it's gitignored
```

## Check status

```bash
kubectl get pods -n musicrank
kubectl get deployment,statefulset,svc -n musicrank
```

## URLs

Docker Desktop's LoadBalancer implementation binds `type: LoadBalancer`
Services straight to `localhost` at the Service's `port`, same as Docker
Compose:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Vote API | http://localhost:4001 |
| Ranking API | http://localhost:4002 |

Postgres and Redis are `ClusterIP` (cluster-internal only, per spec §18) —
not reachable from the host directly; use `kubectl exec` or `port-forward`
to reach them for debugging.

## Design notes

- **DATABASE_URL is a Secret, not split across ConfigMap+Secret.** Spec
  §19's example splits `DATABASE_HOST`/`DATABASE_NAME` (ConfigMap) from
  `DATABASE_USER`/`DATABASE_PASSWORD` (Secret), implying services assemble
  their own connection string. Ours take one `DATABASE_URL` env var
  instead, which embeds the password — so the whole string has to live in
  the Secret. `REDIS_URL` has no credentials, so it stays in the ConfigMap.
- **`/ready` vs `/health`.** vote-api and ranking-api each gained a
  `/ready` endpoint (checking Redis/Postgres are actually reachable) during
  this phase, used for the readiness probe; `/health` (always 200 if the
  process is up) is the liveness probe. Spec §20 calls this split out
  explicitly — readiness should catch "up but can't reach a dependency
  yet," liveness shouldn't, or Kubernetes would restart a pod that a
  downstream outage made temporarily unready, which doesn't fix anything.
- **Postgres init via ConfigMap, not a custom image.** `postgres/
  configmap-init.yaml` is `kubectl create configmap --from-file`'s output
  wrapping `database/migrations/0001_init.sql` and `database/seed/seed.sql`
  — mounted at `/docker-entrypoint-initdb.d`, same mechanism Docker Compose
  uses via bind mount. It's a generated snapshot, not hand-written — see
  the regeneration command in its own header comment.
- **Frontend's API URLs are baked in at image build time** (Vite inlines
  `import.meta.env.VITE_*` into the JS bundle), not read from a runtime
  ConfigMap — see `frontend/Dockerfile`'s `ARG`s. They point at
  `localhost:4001`/`4002` because the browser calls those APIs directly,
  not through the frontend container, and that's where this setup
  publishes them.
- **Resource requests/limits** (spec §21) are set on every container.
  Node services: 100m/128Mi requests, 500m/512Mi limits (spec's own
  example values). nginx (frontend): lighter, 50m/64Mi–200m/128Mi. Redis
  and Postgres: sized for a small single-instance workload, not tuned
  against real load. No HPA yet — spec marks it "Advanced," treating it as
  a stretch add-on once this base is solid.
- **Explicit image tags, not `:latest`.** Every Deployment pins a real
  version tag (`musicrank-vote-api:v0.2.0`, etc) instead of `:latest`.
  Found out why while testing rolling updates: with `imagePullPolicy:
  IfNotPresent` and a `:latest` tag, rebuilding the image's *contents*
  without changing the tag doesn't change the Deployment manifest at all
  — Kubernetes has nothing to diff, so `kubectl apply` is a silent no-op
  and no rollout happens, even though the image on disk is newer. Explicit
  tags make every real change an actual manifest diff, which is what
  triggers a rollout.
- **vote-api's `/health` now reports its own version** (read from
  `package.json` at startup), specifically so a rolling update is
  observable from the outside — `curl localhost:4001/health` shows the
  version flip mid-rollout, not just "pods got replaced."

## Phase 6 verification (scaling, self-healing, rolling updates)

All three done live against this deployment, not just configured:

- **Resource limits + 3 replicas each** for frontend/vote-api/ranking-api/
  worker (up from 2) — applied via normal `kubectl apply`, confirmed with
  `kubectl rollout status` and `kubectl get pods`.
- **Pod failure / self-healing**: deleted a running vote-api pod while a
  script hit `/health` every 150ms. Result: 60/60 requests succeeded (0
  failed) — the Service routed around the dead pod via the other 2
  replicas the entire time, and Kubernetes replaced the deleted pod
  automatically, restoring 3/3.
- **Rolling update**: bumped vote-api's version, built
  `musicrank-vote-api:v0.2.0`, updated the Deployment's image tag, and
  applied it while hammering `/health` continuously. 100 requests, 0
  failures, and the response body's `version` field was confirmed to flip
  from the old build to `0.2.0` as the rollout progressed — a real
  zero-downtime rollover, not just "the pods eventually came back."
