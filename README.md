# tier-list-league

Web app monorepo (npm workspaces).

## Packages

- `packages/frontend` — Next.js + React + Tailwind app (deploys to Vercel).
- `packages/backend` — Node API with a PostgreSQL database managed by Drizzle, runnable via Docker.

## Tooling

- Node `24.18.0` (see `.nvmrc`; run `nvm use`).
- TypeScript 7 for type-checking (installed as the `tsc-native` alias; each package exposes `npm run typecheck`).
- Biome for lint + format (`npm run check`, `npm run format`). Format-on-save is preconfigured for VS Code in `.vscode/`.

## Common commands

```bash
nvm use
npm install
npm run check       # biome lint + format check
npm run typecheck   # type-check every workspace
```
