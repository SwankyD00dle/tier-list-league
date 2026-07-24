# @tier-list-league/backend

Node HTTP API backed by PostgreSQL, with schema and migrations managed by Drizzle. Runs in Docker.

## Run with Docker (recommended)

```bash
docker compose up --build
```

This starts PostgreSQL and the backend (http://localhost:3001, health at `/health`).

## Local development

```bash
nvm use
npm install                                   # from the repo root
cp packages/backend/.env.example packages/backend/.env
npm run dev --workspace @tier-list-league/backend
```

## Migrations (Drizzle)

```bash
npm run db:generate --workspace @tier-list-league/backend   # SQL from src/db/schema.ts -> ./drizzle
npm run db:migrate  --workspace @tier-list-league/backend   # apply to DATABASE_URL
```

`db:push` (dev-only sync) and `db:studio` are also available.

## Scripts

- `dev` / `start` — run the server with tsx.
- `typecheck` — type-check with TypeScript 7 (`tsc-native`).
- `db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle Kit.

## HTTP API

The server (`npm run start`) mounts routes through a small router over `node:http`. Routes are defined with `defineRoute` under `src/api/routes/` and registered in `src/api/routes/index.ts`.

| Method | Path              | Description            |
| ------ | ----------------- | ---------------------- |
| GET    | `/health`         | Liveness + DB probe    |
| GET    | `/users`          | List users             |
| POST   | `/users`          | Create a user          |
| GET    | `/users/:id`      | Get a user by id       |
| GET    | `/games`          | List games             |
| GET    | `/games/:id`      | Get a game by id       |
| GET    | `/rounds/:id`     | Get a round by id      |
| GET    | `/tier-lists/:id` | Get a tier list by id  |

Example:

```bash
curl localhost:3001/users
curl -X POST localhost:3001/users -H 'content-type: application/json' \
  -d '{"name":"Ryan","discordUserId":"123","games":[]}'
```
