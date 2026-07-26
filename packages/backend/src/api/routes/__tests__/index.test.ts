import { describe, expect, it } from "vitest";
import { db } from "../../../database/client";
import type { Logger } from "../../handler";
import { buildRoutes } from "..";

const log: Logger = {
  info() {},
  error() {},
};

describe("buildRoutes", () => {
  it("registers every backend endpoint under /api", () => {
    const routes = buildRoutes({ log, db });

    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "GET /api/health",
      "GET /api/auth/discord",
      "GET /api/auth/discord/callback",
      "POST /api/auth/refresh",
      "POST /api/auth/logout",
      "GET /api/auth/me",
      "GET /api/users",
      "POST /api/users",
      "GET /api/users/:id",
      "GET /api/games",
      "POST /api/games",
      "GET /api/games/:id",
      "PATCH /api/games/:id",
      "POST /api/games/:gameId/participants",
      "DELETE /api/games/:gameId/participants/:userId",
      "POST /api/games/:gameId/rounds",
      "POST /api/games/:gameId/score",
      "GET /api/games/:gameId/score",
      "GET /api/games/:gameId/score/:userId",
      "GET /api/rounds/:id",
      "PATCH /api/rounds/:id",
      "POST /api/rounds/:roundId/guesses",
      "POST /api/rounds/:roundId/tier-lists",
      "GET /api/tier-lists/:id",
    ]);
    expect(routes.every(({ path }) => path.startsWith("/api/"))).toBe(true);
  });
});
