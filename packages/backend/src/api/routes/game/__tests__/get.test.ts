import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { getGame } from "../get";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

describe("getGame", () => {
  it("returns a game by id", async () => {
    const database = createMockDb({
      selectResult: [
        {
          id: gameId,
          name: "Season 1",
          description: "First season",
          participants: [],
          roundCount: 1,
          rounds: [],
          createdBy: null,
          createdAt,
          updatedAt,
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = getGame(createMockConfig(database));

    await route.handler({ params: { id: gameId } }, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      game: {
        id: gameId,
        name: "Season 1",
        description: "First season",
        participants: [],
        roundCount: 1,
        rounds: [],
        createdBy: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("returns 404 when the game is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getGame(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler({ params: { id: gameId } }, res);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Game not found",
    });
  });

  it("returns 400 for an invalid id", async () => {
    const { res, state } = createMockResponse();
    const route = getGame(createMockConfig());

    await route.handler({ params: { id: "bad" } }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });

  it("returns 400 when id is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getGame(createMockConfig());

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });
});
