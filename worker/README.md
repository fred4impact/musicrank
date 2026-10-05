# worker

Consumes vote events from the Redis `music:votes` list (BRPOP), validates
them, and persists them to Postgres: inserts/updates the vote, lazily creates
the anonymous user row on first vote, and recomputes `song_statistics` for
that song.

## Processing rules

- Dedup by `event_id` — replaying the exact same event is a no-op.
- A user voting again on the same song (new `event_id`, same `user_id` +
  `song_id`) updates their existing vote rather than creating a second one.
- A permanently invalid event (e.g. a `songId` that doesn't exist) is logged
  and dropped, not retried.
- Any other failure (e.g. a dropped DB connection) is requeued onto
  `music:votes` after a short delay.

## Local development

```bash
npm install
npm run dev     # requires REDIS_URL and DATABASE_URL (both default to localhost)
npm test        # integration tests — needs postgres running and migrated
npm run lint    # eslint
npm run typecheck
```
