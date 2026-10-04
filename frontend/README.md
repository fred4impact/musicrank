# frontend

React + TypeScript + Vite + Tailwind CSS v4. Talks to two backend services
directly (no API gateway in V1):

- `VITE_VOTE_API_URL` (default `http://localhost:4001`) — submitting votes
- `VITE_RANKING_API_URL` (default `http://localhost:4002`) — everything else

## Pages

- `/` — home, top-ranked preview
- `/songs` — full catalogue, filterable by genre
- `/songs/:id` — song detail + 1–5 star voting
- `/artists/:id` — artist's songs
- `/rankings` — global / trending tabs

## Voting identity

No login in V1 (spec §25). `src/lib/clientId.ts` generates a UUID on first
visit and persists it in `localStorage`; it's sent as `userId` with every
vote so "one vote per song, latest wins" works without an account.

## Local development

Requires vote-api and ranking-api running (see their READMEs), with
`FRONTEND_ORIGIN` on both matching this app's dev origin (defaults already
line up: `http://localhost:5173`).

```bash
npm install
npm run dev
npm run build   # tsc -b && vite build
```
