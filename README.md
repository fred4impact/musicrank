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

## Status

Phases 1–4 of `spec.md`'s build plan are done: database, all three backend
services, the frontend, and now Docker/Docker Compose — the full MVP loop
(§35) runs end-to-end in containers. Kubernetes (Phase 5) is next.
