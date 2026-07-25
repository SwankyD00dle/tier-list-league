import { describe, expect, it } from "vitest";
import { createMockConfig, createMockDb, createMockResponse } from "../../../../test-helpers";
import { submitGuess } from "../create";

const roundId = "550e8400-e29b-41d4-a716-446655440000";
const gameId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440002";
const guessId = "550e8400-e29b-41d4-a716-446655440003";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const savedGuess = {
  id: guessId,
  round: roundId,
  data: "Pepperoni",
  createdBy: userId,
  createdAt,
  updatedAt: createdAt,
};

describe("submitGuess", () => {
  it("creates a new guess and returns 201", async () => {
    const database = createMockDb({
      selectResults: [
        [{ game: gameId, guesses: [], winningGuess: null }],
        [{ participants: [userId] }],
        [],
      ],
      insertResult: [savedGuess],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      { params: { roundId }, body: { userId, data: "Pepperoni" } },
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toMatchObject({ ok: true, guess: { id: guessId, data: "Pepperoni" } });
  });

  it("replaces an existing guess and returns 200", async () => {
    const database = createMockDb({
      selectResults: [
        [{ game: gameId, guesses: [guessId], winningGuess: null }],
        [{ participants: [userId] }],
        [{ id: guessId }],
      ],
      updateResult: [{ ...savedGuess, data: "Pineapple" }],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      { params: { roundId }, body: { userId, data: "Pineapple" } },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true, guess: { data: "Pineapple" } });
  });

  it("rejects guesses on a finalized round", async () => {
    const database = createMockDb({
      selectResult: [{ game: gameId, guesses: [], winningGuess: guessId }],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      { params: { roundId }, body: { userId, data: "Pepperoni" } },
      res,
    );

    expect(state.statusCode).toBe(409);
    expect(state.body).toMatchObject({ ok: false, code: "ROUND_FINALIZED" });
  });

  it("rejects non-participants", async () => {
    const database = createMockDb({
      selectResults: [[{ game: gameId, guesses: [], winningGuess: null }], [{ participants: [] }]],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      { params: { roundId }, body: { userId, data: "Pepperoni" } },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: "INVALID_PLAYER" });
  });
});
