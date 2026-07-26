# @tier-list-league/api-schema

Single source of truth for the backend HTTP API contract.

- `src/schema` holds the zod mini request and response schemas, one file per API area,
  a barrel (`index.ts`), and a type-only entry point (`types.ts`).
- `src/typechecks` holds one type guard per request and response. Each guard delegates to the
  internal `matchesSchema` helper, which is deliberately not exported from the package so callers
  always go through a named, schema-bound guard.

## Entry points

| Import                                   | Contents                                        |
| ---------------------------------------- | ----------------------------------------------- |
| `@tier-list-league/api-schema`           | Schemas and typechecks (runtime dependency)      |
| `@tier-list-league/api-schema/types`     | Types only, safe to take as a dev dependency     |
