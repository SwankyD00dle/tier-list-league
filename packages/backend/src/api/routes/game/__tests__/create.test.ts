import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import { createMockConfig, createMockDb, createMockResponse } from "../../../test-helpers";
import { createGame } from "../create";

const creatorId = "550e8400-e29b-41d4-a716-446655440000";
const playerId = "550e8400-e29b-41d4-a716-446655440001";
const gameId = "550e8400-e29b-41d4-a716-446655440002";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("createGame", () => {
  it("creates a game, dedupes the creator, and returns 201", async () => {
    const database = createMockDb({
      selectResult: [{ id: creatorId }, { id: playerId }],
      insertResult: [
        {
          id: gameId,
          name: "Season 1",
          description: "First season",
          participants: [creatorId, playerId],
          roundCount: 5,
          rounds: [],
          createdBy: creatorId,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
    const { res, state } = createMockResponse();

    await createGame(createMockConfig(database)).handler(
      {
        body: {
          name: "Season 1",
          description: "First season",
          roundCount: 5,
          createdBy: creatorId,
          participants: [creatorId, playerId],
        },
      },
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toEqual({
      ok: true,
      game: {
        id: gameId,
        name: "Season 1",
        description: "First season",
        participants: [creatorId, playerId],
        roundCount: 5,
        rounds: [],
        createdBy: creatorId,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(database.update).toHaveBeenCalledOnce();
  });

  it("rejects unknown participants", async () => {
    const database = createMockDb({ selectResult: [{ id: creatorId }] });
    const { res, state } = createMockResponse();

    await createGame(createMockConfig(database)).handler(
      {
        body: {
          name: "Season 1",
          description: "First season",
          roundCount: 5,
          createdBy: creatorId,
          participants: [playerId],
        },
      },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      ok: false,
      code: "INVALID_PLAYER",
      message: "Every participant must be an existing user",
    });
  });

  it("validates the body", async () => {
    const { res, state } = createMockResponse();

    await createGame(createMockConfig()).handler({ body: { name: "" } }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: REQUEST_SCHEMA_FAILURE_CODE });
  });
});
