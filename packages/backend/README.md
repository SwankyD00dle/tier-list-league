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
