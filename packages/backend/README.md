# @tier-list-league/backend

Node HTTP API backed by PostgreSQL, with schema and migrations managed by Drizzle. Runs in Docker.

## Local development

Run the full app from the repository root:

```bash
nvm use
npm install
npm run db:migrate --workspace @tier-list-league/backend
npm run dev
```

The frontend and API share http://localhost:3000. Next.js proxies `/api/*` to the backend's internal listener on port 3001.

To run only the backend:

```bash
cp packages/backend/.env.example packages/backend/.env
npm run dev --workspace @tier-list-league/backend
```

## Run the backend with Docker

From `packages/backend`:

```bash
docker compose up --build
```

This starts PostgreSQL and the standalone backend on its internal/development port 3001. The root `npm run dev` command is what exposes the combined frontend + API origin on port 3000.

## Migrations (Drizzle)

```bash
npm run db:generate --workspace @tier-list-league/backend
npm run db:migrate --workspace @tier-list-league/backend
```

`db:push` (dev-only sync) and `db:studio` are also available.

## Scripts

- `dev` / `start` — run the standalone backend on `PORT` (default 3001).
- `typecheck` — type-check with TypeScript 7 (`tsc-native`).
- `test` / `test:watch` — run route tests with Vitest.
- `db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle Kit.

## HTTP API

Routes are defined under `src/api/routes/` and registered in `src/api/routes/index.ts`.

| Method | Public path                | Description           |
| ------ | -------------------------- | --------------------- |
| GET    | `/api/health`              | Liveness + DB probe   |
| GET    | `/api/users`               | List users            |
| POST   | `/api/users`               | Create a user         |
| GET    | `/api/users/:id`           | Get a user by id      |
| GET    | `/api/games`               | List games            |
| GET    | `/api/games/:id`           | Get a game by id      |
| POST   | `/api/games/:gameId/score` | Record round scores   |
| GET    | `/api/games/:gameId/score` | Get the scoreboard    |
| GET    | `/api/games/:gameId/score/:userId` | Get a player's score |
| GET    | `/api/rounds/:id`          | Get a round by id     |
| GET    | `/api/tier-lists/:id`      | Get a tier list by id |

Examples through the shared port:

```bash
curl http://localhost:3000/api/users
curl -X POST http://localhost:3000/api/users -H 'content-type: application/json' \
  -d '{"name":"Ryan","discordUserId":"123","games":[]}'
```

### Scoring

Scoring is calculated only by the backend. A winner receives 3 points and each honorable mention receives 1 point; clients submit awards, never point values.

```text
POST /api/games/:gameId/score
GET  /api/games/:gameId/score
GET  /api/games/:gameId/score/:userId
```

The POST body identifies the round, its recorded host, the winning guess, and honorable-mention guesses with display titles:

```json
{
  "round": {
    "id": "<round-uuid>",
    "hostedBy": "<host-user-uuid>",
    "winningGuess": "<guess-uuid>",
    "honorableMentions": [
      {
        "guessId": "<guess-uuid>",
        "title": "Answer was completely on point"
      }
    ]
  }
}
```

Score reads are keyed by user ID. Each player has a running `total` and only rounds where they scored. A round contains its summed `score` and an `entries` array because one player can receive multiple awards in the same round. Reposting a round replaces that round's prior entries atomically, so retries and corrections do not double-score.

### Remaining UI API gaps

The current API can read users, games, rounds, tier lists, and scores, and can create users. A complete game UI still needs mutation endpoints for games/participants, rounds, guesses, and participant tier lists, plus authentication so the server can verify the caller is the recorded host. A composite game-state endpoint may also be useful if the UI otherwise needs several requests to render one game screen.
