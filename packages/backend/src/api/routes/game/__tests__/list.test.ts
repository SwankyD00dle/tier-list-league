import { describe, expect, it } from "vitest";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { listGames } from "../list";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

describe("listGames", () => {
  it("returns games from the database", async () => {
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
    const route = listGames(createMockConfig(database));

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      games: [
        {
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
      ],
    });
  });

  it("returns an empty list when no games exist", async () => {
    const { res, state } = createMockResponse();
    const route = listGames(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true, games: [] });
  });
});
