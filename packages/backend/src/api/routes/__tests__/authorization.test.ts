import { isApiErrorResponse } from "@tier-list-league/api-schema";
import { describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_COOKIE } from "../../auth/cookies";
import type { ApiRequest } from "../../route-helper";
import {
  authenticatedRequest,
  createMockConfig,
  createMockDb,
  createMockResponse,
} from "../../test-helpers";
import { buildRoutes } from "../index";

const admin = "550e8400-e29b-41d4-a716-446655440000";
const host = "550e8400-e29b-41d4-a716-446655440001";
const player = "550e8400-e29b-41d4-a716-446655440002";
const outsider = "550e8400-e29b-41d4-a716-446655440003";
const gameId = "550e8400-e29b-41d4-a716-446655440004";
const roundId = "550e8400-e29b-41d4-a716-446655440005";
const tierListId = "550e8400-e29b-41d4-a716-446655440006";
const gameRow = { createdBy: admin, participants: [admin, host, player], rounds: [roundId] };
const roundRow = {
  id: roundId,
  game: gameId,
  hostedBy: host,
  winningGuess: null,
  guesses: [],
  tierList: null,
  participantTierLists: [],
};
const tierData = { SS: [], S: [], A: [], B: [], C: [], D: [], E: [], F: [] };

function gameplayRoutes(database = createMockDb()) {
  return buildRoutes(createMockConfig(database)).filter(({ path }) =>
    /^\/api\/(games|rounds|tier-lists)(\/|$)/.test(path),
  );
}

function route(method: string, path: string, database: ReturnType<typeof createMockDb>) {
  const found = gameplayRoutes(database).find(
    (candidate) => candidate.method === method && candidate.path === path,
  );
  if (!found) throw new Error(`Missing route: ${method} ${path}`);
  return found.definition;
}

function expectNoWrites(database: ReturnType<typeof createMockDb>) {
  expect(database.insert).not.toHaveBeenCalled();
  expect(database.update).not.toHaveBeenCalled();
  expect(database.delete).not.toHaveBeenCalled();
}

function expectForbidden(state: ReturnType<typeof createMockResponse>["state"]) {
  expect(state.statusCode).toBe(403);
  expect(state.body).toMatchObject({ ok: false, code: "FORBIDDEN" });
  expect(isApiErrorResponse(state.body)).toBe(true);
}

describe("gameplay authentication", () => {
  for (const { method, path } of gameplayRoutes()) {
    it.each([undefined, "", `${ACCESS_TOKEN_COOKIE}=not-a-token`])(
      `${method} ${path} rejects a missing/invalid cookie (%s) before touching the DB`,
      async (cookie) => {
        const database = createMockDb();
        const { res, state } = createMockResponse();
        await route(method, path, database).handler(
          { headers: cookie === undefined ? {} : { cookie } },
          res,
        );
        expect(state.statusCode).toBe(401);
        expect(state.body).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
        expect(isApiErrorResponse(state.body)).toBe(true);
        expect(database.select).not.toHaveBeenCalled();
        expect(database.transaction).not.toHaveBeenCalled();
        expectNoWrites(database);
      },
    );
  }

  it("rejects an expired signed access cookie", async () => {
    vi.stubEnv("ACCESS_TOKEN_TTL_SECONDS", "-1");
    try {
      const { res, state } = createMockResponse();
      await route("GET", "/api/games", createMockDb()).handler(await authenticatedRequest(), res);
      expect(state.statusCode).toBe(401);
    } finally {
      vi.stubEnv("ACCESS_TOKEN_TTL_SECONDS", "900");
    }
  });
});

const adminActions: { method: string; path: string; request: ApiRequest; rows: unknown[][] }[] = [
  {
    method: "PATCH",
    path: "/api/games/:id",
    request: { params: { id: gameId }, body: { name: "Changed" } },
    rows: [[gameRow]],
  },
  {
    method: "POST",
    path: "/api/games/:gameId/participants",
    request: { params: { gameId }, body: { userId: outsider } },
    rows: [[gameRow]],
  },
  {
    method: "DELETE",
    path: "/api/games/:gameId/participants/:userId",
    request: { params: { gameId, userId: player } },
    rows: [[gameRow]],
  },
  {
    method: "POST",
    path: "/api/games/:gameId/rounds",
    request: { params: { gameId }, body: { topic: "Topic", hostedBy: host } },
    rows: [[gameRow]],
  },
  {
    method: "PATCH",
    path: "/api/rounds/:id",
    request: { params: { id: roundId }, body: { hostedBy: player } },
    rows: [[roundRow], [gameRow]],
  },
];

describe("admin-only mutations", () => {
  for (const action of adminActions) {
    it.each([host, player, outsider])(
      `${action.method} ${action.path} denies non-admin %s`,
      async (userId) => {
        const database = createMockDb({ selectResults: action.rows });
        const { res, state } = createMockResponse();
        await route(action.method, action.path, database).handler(
          await authenticatedRequest(action.request, userId),
          res,
        );
        expectForbidden(state);
        expectNoWrites(database);
      },
    );
  }
});

const participantReads: { path: string; params: Record<string, string>; rows: unknown[][] }[] = [
  { path: "/api/games/:id", params: { id: gameId }, rows: [[gameRow]] },
  { path: "/api/rounds/:id", params: { id: roundId }, rows: [[roundRow], [gameRow]] },
  { path: "/api/games/:gameId/score", params: { gameId }, rows: [[gameRow]] },
  {
    path: "/api/games/:gameId/score/:userId",
    params: { gameId, userId: player },
    rows: [[gameRow]],
  },
  {
    path: "/api/tier-lists/:id",
    params: { id: tierListId },
    rows: [[{ id: tierListId, createdBy: outsider }], []],
  },
];

describe("participant-only reads", () => {
  for (const read of participantReads) {
    it(`${read.path} denies non-members (tier-list authorship alone is insufficient)`, async () => {
      const database = createMockDb({ selectResults: read.rows });
      const { res, state } = createMockResponse();
      await route("GET", read.path, database).handler(
        await authenticatedRequest({ params: read.params }, outsider),
        res,
      );
      expectForbidden(state);
      expectNoWrites(database);
    });
  }

  it("does not grant an unenrolled admin participant read access", async () => {
    const database = createMockDb({ selectResult: [{ ...gameRow, participants: [player] }] });
    const { res, state } = createMockResponse();
    await route("GET", "/api/games/:id", database).handler(
      await authenticatedRequest({ params: { id: gameId } }, admin),
      res,
    );
    expectForbidden(state);
  });

  it("denies reads of an orphaned round", async () => {
    const database = createMockDb({ selectResult: [{ ...roundRow, game: null }] });
    const { res, state } = createMockResponse();
    await route("GET", "/api/rounds/:id", database).handler(
      await authenticatedRequest({ params: { id: roundId } }, host),
      res,
    );
    expectForbidden(state);
  });
});

describe("submission identity and roles", () => {
  for (const { path, data } of [
    { path: "/api/rounds/:roundId/guesses", data: "A guess" },
    { path: "/api/rounds/:roundId/tier-lists", data: tierData },
  ]) {
    it(`${path} rejects impersonating the host`, async () => {
      const database = createMockDb();
      const { res, state } = createMockResponse();
      await route("POST", path, database).handler(
        await authenticatedRequest({ params: { roundId }, body: { userId: host, data } }, player),
        res,
      );
      expectForbidden(state);
      expect(database.transaction).not.toHaveBeenCalled();
      expectNoWrites(database);
    });

    it.each([null, tierListId])(
      `${path} rejects a non-member using their own identity, including finalized rounds (%s)`,
      async (winningGuess) => {
        const database = createMockDb({
          selectResults: [[{ ...roundRow, winningGuess }], [gameRow]],
        });
        const { res, state } = createMockResponse();
        await route("POST", path, database).handler(
          await authenticatedRequest(
            { params: { roundId }, body: { userId: outsider, data } },
            outsider,
          ),
          res,
        );
        expectForbidden(state);
        expectNoWrites(database);
      },
    );
  }

  it.each([admin, player, outsider])(
    "only the recorded host may finalize awards, not %s",
    async (userId) => {
      const database = createMockDb({ selectResults: [[gameRow], [roundRow]] });
      const { res, state } = createMockResponse();
      await route("POST", "/api/games/:gameId/score", database).handler(
        await authenticatedRequest(
          {
            params: { gameId },
            body: {
              round: {
                id: roundId,
                hostedBy: userId,
                winningGuess: tierListId,
                honorableMentions: [],
              },
            },
          },
          userId,
        ),
        res,
      );
      expectForbidden(state);
      expectNoWrites(database);
    },
  );

  it("rejects spoofing the recorded host in the award body", async () => {
    const database = createMockDb();
    const { res, state } = createMockResponse();
    await route("POST", "/api/games/:gameId/score", database).handler(
      await authenticatedRequest(
        {
          params: { gameId },
          body: {
            round: { id: roundId, hostedBy: host, winningGuess: tierListId, honorableMentions: [] },
          },
        },
        player,
      ),
      res,
    );
    expectForbidden(state);
    expect(database.transaction).not.toHaveBeenCalled();
    expectNoWrites(database);
  });
});
