# ranking-api

Read-only service exposing rankings and catalog data from Postgres.

## Endpoints

- `GET /health` — liveness: always 200 if the process is up
- `GET /ready` — readiness: 200 if Postgres is reachable, 503 otherwise
- `GET /api/v1/rankings/global?limit=&offset=` — Bayesian-weighted ranking (see below)
- `GET /api/v1/rankings/trending?limit=&offset=` — votes in the last 24h
- `GET /api/v1/songs?limit=&offset=&genre=`
- `GET /api/v1/songs/:id`
- `GET /api/v1/artists/:id`
- `GET /api/v1/genres`

## Ranking formula

Spec §12 explicitly requires that "a song with only one vote should not
automatically dominate a song with thousands of votes." A raw average
doesn't satisfy that, so `/rankings/global` uses a Bayesian-weighted score
computed at query time:

```
score = (v / (v + m)) * average_rating + (m / (v + m)) * global_average
```

`v` is the song's vote count, `m` (= 5) is a confidence constant — a song's
score is pulled toward the catalog-wide mean until it has roughly `m` votes.
`song_statistics.ranking_score` (written by the worker) is currently just a
placeholder equal to `average_rating`; it isn't used for ordering here since
this formula needs the global mean, which isn't known per-song.

## Local development

```bash
npm install
npm run dev    # requires DATABASE_URL (defaults to localhost)
npm test       # integration tests — needs postgres running, migrated, seeded
```
