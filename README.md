# tier-list-league

Web app monorepo (npm workspaces).

## Packages

- `packages/frontend` — Next.js + React + Tailwind app (deploys to Vercel). `api/api.ts` is the typed client for the backend.
- `packages/backend` — Node API with a PostgreSQL database managed by Drizzle, runnable via Docker.
- `packages/api-schema` — shared zod mini request/response schemas plus a typecheck per payload. Import `@tier-list-league/api-schema` for schemas and typechecks, or `@tier-list-league/api-schema/types` for types only.

## Local development

```bash
nvm use
npm install
npm run db:migrate --workspace @tier-list-league/backend
npm run dev
```

Open http://localhost:3000. The Next.js frontend owns the public listener on port 3000 and proxies `/api/*` to the backend's internal listener on port 3001, so both the UI and API share one origin:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/users
```

Two processes cannot bind the same TCP port. Port 3001 is an implementation detail used only between the Next proxy and backend; browser and frontend code should use relative `/api/*` URLs on port 3000.

## Tooling

- Node `24.18.0` (see `.nvmrc`; run `nvm use`).
- TypeScript 7 for type-checking (installed as the `tsc-native` alias; each package exposes `npm run typecheck`).
- Biome for lint + format (`npm run check`, `npm run format`). Format-on-save is preconfigured for VS Code in `.vscode/`.

## Common commands

```bash
npm run dev         # frontend + backend; public origin is localhost:3000
npm run check       # biome lint + format check
npm run typecheck   # type-check every workspace
```
