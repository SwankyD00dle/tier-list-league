# @tier-list-league/frontend

Next.js (App Router) + React + Tailwind CSS.

## Develop the full app

From the repository root:

```bash
nvm use
npm install
npm run dev
```

Open http://localhost:3000. Next.js serves the frontend and proxies `/api/*` to the backend, so frontend code should use relative URLs such as `fetch("/api/users")`.

`BACKEND_URL` controls the internal proxy destination and defaults to `http://localhost:3001`. See `.env.example`.

## Scripts

- `dev` — start only the Next dev server.
- `build` / `start` — production build and serve.
- `typecheck` — type-check with TypeScript 7 (`tsc-native`).

## Notes

- Styling uses Tailwind CSS v4 via `@tailwindcss/postcss`; global styles live in `app/globals.css`.
- Type-checking runs on TypeScript 7. Next's own toolchain still resolves `typescript` 5.9 (Next needs the TS compiler API, which the native TS 7 package does not expose until 7.1), so both are declared intentionally.
