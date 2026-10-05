# MusicRank

A containerized, event-driven music ranking platform. Users rate songs 1–5;
votes are queued through Redis, processed by a worker, persisted in
Postgres, and aggregated into rankings. Built primarily to demonstrate
microservice architecture, async processing, and container/Kubernetes
deployment — see `spec.md` for the full design doc and build log.

## Architecture

```
Frontend (React) --> Vote API --> Redis (queue) --> Worker --> PostgreSQL
                                                                     ^
                                                    Ranking API -----+
                                                           ^
Frontend <----------------------------------------------- +
```

- **vote-api** — validates votes, queues them to Redis. Never touches Postgres.
- **worker** — consumes the queue, persists votes, recomputes song stats.
- **ranking-api** — read-only: rankings (Bayesian-weighted global, 24h trending), songs, artists, genres.
- **frontend** — React/Vite/Tailwind. Anonymous voting via a client-generated UUID (no auth in V1).

Each service has its own README with endpoint/implementation details.

## Running locally

```bash
docker compose up -d --build
```

That's it — Postgres schema + seed data load automatically on first boot
(via `docker-entrypoint-initdb.d`, see `docker-compose.yml`), and all five
services come up healthy once their dependencies are ready.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Vote API | http://localhost:4001 (`/health`) |
| Ranking API | http://localhost:4002 (`/health`, `/api/v1/rankings/global`) |
| Postgres | localhost:5432 (`musicrank`/`musicrank`) |
| Redis | localhost:6379 |

Check status: `docker compose ps`. Tear down: `docker compose down` (add
`-v` to also wipe the Postgres volume and reseed from scratch next time).

## Running on Kubernetes

See `kubernetes/README.md` — same five services, same URLs, deployed to a
local cluster (tested against Docker Desktop's built-in Kubernetes)
instead of Docker Compose. Covers the deploy order, first-time secret
setup, and a couple of non-obvious gotchas worth reading before `kubectl
apply`.

## Running services individually (without Docker)

Each service's own README covers `npm install && npm run dev`, which is
faster for iterating on one service. Needs `docker compose up -d postgres
redis` for the two infra dependencies either way.

## Tests

```bash
cd vote-api && npm test      # unit + mocked-route tests
cd worker && npm test        # integration tests, needs postgres running+migrated
cd ranking-api && npm test   # integration tests, needs postgres running+migrated+seeded
```

Each backend service also has `npm run lint` (ESLint) and `npm run
typecheck` (`tsc --noEmit`) — both are part of CI below.

## CI/CD

`.github/workflows/test.yml` — lint, typecheck, and test all 4 services on
every push/PR. `ranking-api`/`worker` get a real Postgres service container
(migrated + seeded), matching how their integration tests run locally —
not mocked, same reasoning as the local test suites.

`.github/workflows/build.yml` — on push to `main`, calls `test.yml` as a
gate (`uses: ./.github/workflows/test.yml`), then builds and pushes all 4
Docker images to GHCR (`ghcr.io/<owner>/musicrank-<service>:latest` and
`:<commit-sha>`) once tests pass. Deployment stays manual (spec §29's own
guidance) — there's also no internet-reachable cluster for a hosted runner
to deploy to; this project's Kubernetes is local-only.

Both workflows were verified locally with [`act`](https://github.com/nektos/act)
before ever being pushed — each of the 4 test jobs confirmed passing
individually against real service containers, and `build.yml`'s reusable-
workflow structure (gating the Docker build behind `test.yml` passing)
confirmed to parse and stage correctly. The actual GHCR push step wasn't
run locally (needs real registry credentials), so that part will get its
first real run on an actual push to GitHub.

While verifying this, found and fixed a real bug: deliberately disrupting
Postgres mid-test (to check `act`'s Postgres service container behavior)
crashed every `ranking-api`/`worker` pod in the live Kubernetes cluster at
once — `pg.Pool` emits an `'error'` event on a dropped idle connection, and
with no listener, Node's default behavior is to throw and crash the
process. Fixed in both services' `db.ts` (`pool.on("error", ...)` — log and
let the pool reconnect, instead of taking the whole process down over a
transient connection blip) and redeployed to the live cluster.

## Monitoring

See `monitoring/README.md` — Prometheus (auto-discovers every app pod via
annotations, no ServiceMonitor CRDs) + `kube-state-metrics` (pod restarts,
replica status) + Grafana, with the datasource and a 16-panel dashboard
both provisioned on boot. Grafana: http://localhost:3000 (anonymous viewer
access). Prometheus: http://localhost:9090.

## Status

Phases 1–8 of `spec.md`'s build plan are done: database, all three backend
services, the frontend, Docker/Docker Compose, Kubernetes, scaling, CI/CD,
and now monitoring. HPA, tracing, and alerting are the remaining stretch
items — spec's core build plan is otherwise complete.
