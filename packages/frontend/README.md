# @tier-list-league/frontend

Next.js (App Router) + React + Tailwind CSS.

## Develop

```bash
nvm use
npm install          # run from the repo root
npm run dev --workspace @tier-list-league/frontend
```

Open http://localhost:3000.

## Scripts

- `dev` — start the Next dev server.
- `build` / `start` — production build and serve.
- `typecheck` — type-check with TypeScript 7 (`tsc-native`).

## Notes

- Styling uses Tailwind CSS v4 via `@tailwindcss/postcss`; global styles live in `app/globals.css`.
- Type-checking runs on TypeScript 7. Next's own toolchain still resolves `typescript` 5.9 (Next needs the TS compiler API, which the native TS 7 package does not expose until 7.1), so both are declared intentionally.
