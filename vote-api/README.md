# vote-api

Receives votes, validates them structurally, and pushes a vote event onto the
Redis `music:votes` list for the worker to process. Never talks to Postgres
directly — see spec §6.

## Endpoints

- `GET /health` → `{ "status": "ok" }` (liveness — always 200 if the process is up)
- `GET /ready` → 200 if Redis is reachable, 503 otherwise (readiness)
- `POST /api/v1/votes` → `{ songId: number, rating: 1-5, userId: uuid }`

## Local development

```bash
npm install
npm run dev        # requires REDIS_URL (defaults to redis://localhost:6379)
npm test
```
