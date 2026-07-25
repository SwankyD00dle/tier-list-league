import { describe, expect, it } from "vitest";
import { createMockConfig, createMockDb, createMockResponse } from "../../../test-helpers";
import { updateGame } from "../update";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("updateGame", () => {
  it("updates provided fields and returns the game", async () => {
    const database = createMockDb({
      updateResult: [
        {
          id: gameId,
          name: "Season 1 (renamed)",
          description: "First season",
          participants: [],
          roundCount: 8,
          rounds: [],
          createdBy: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
    const { res, state } = createMockResponse();

    await updateGame(createMockConfig(database)).handler(
      { params: { id: gameId }, body: { name: "Season 1 (renamed)", roundCount: 8 } },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
      ok: true,
      game: { name: "Season 1 (renamed)", roundCount: 8 },
    });
  });

  it("rejects an empty update", async () => {
    const { res, state } = createMockResponse();

    await updateGame(createMockConfig()).handler({ params: { id: gameId }, body: {} }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      ok: false,
      code: "EMPTY_UPDATE",
      message: "Provide at least one field to update",
    });
  });

  it("returns 404 when the game is missing", async () => {
    const database = createMockDb({ updateResult: [] });
    const { res, state } = createMockResponse();

    await updateGame(createMockConfig(database)).handler(
      { params: { id: gameId }, body: { name: "New name" } },
      res,
    );

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({ ok: false, code: "NOT_FOUND", message: "Game not found" });
  });
});
