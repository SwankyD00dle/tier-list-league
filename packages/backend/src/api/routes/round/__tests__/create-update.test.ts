import { describe, expect, it } from "vitest";
import { createMockConfig, createMockDb, createMockResponse } from "../../../test-helpers";
import { createRound } from "../create";
import { updateRound } from "../update";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const roundId = "550e8400-e29b-41d4-a716-446655440001";
const hostId = "550e8400-e29b-41d4-a716-446655440002";
const outsiderId = "550e8400-e29b-41d4-a716-446655440003";
const winningGuess = "550e8400-e29b-41d4-a716-446655440004";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const newRound = {
  id: roundId,
  game: gameId,
  roundNumber: 1,
  hostedBy: hostId,
  topic: "Best pizza toppings",
  tierList: null,
  guesses: [],
  winningGuess: null,
  honorableMentions: null,
  honorableMentionDetails: [],
  scoreDeltas: {},
  participantTierLists: null,
  createdAt,
  updatedAt: null,
  endsAt: null,
};

describe("createRound", () => {
  it("creates the next round and returns 201", async () => {
    const database = createMockDb({
      selectResult: [{ participants: [hostId], rounds: [] }],
      insertResult: [newRound],
    });
    const { res, state } = createMockResponse();

    await createRound(createMockConfig(database)).handler(
      { params: { gameId }, body: { topic: "Best pizza toppings", hostedBy: hostId } },
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toMatchObject({
      ok: true,
      round: { id: roundId, roundNumber: 1, hostedBy: hostId, topic: "Best pizza toppings" },
    });
  });

  it("rejects a host who is not a participant", async () => {
    const database = createMockDb({ selectResult: [{ participants: [hostId], rounds: [] }] });
    const { res, state } = createMockResponse();

    await createRound(createMockConfig(database)).handler(
      { params: { gameId }, body: { topic: "Topic", hostedBy: outsiderId } },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      ok: false,
      code: "INVALID_PLAYER",
      message: "The round host must participate in the game",
    });
  });
});

describe("updateRound", () => {
  it("updates an unfinalized round", async () => {
    const database = createMockDb({
      selectResult: [{ id: roundId, game: gameId, winningGuess: null }],
      updateResult: [{ ...newRound, topic: "New topic", updatedAt: createdAt }],
    });
    const { res, state } = createMockResponse();

    await updateRound(createMockConfig(database)).handler(
      { params: { id: roundId }, body: { topic: "New topic" } },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true, round: { topic: "New topic" } });
  });

  it("rejects updates to a finalized round", async () => {
    const database = createMockDb({
      selectResult: [{ id: roundId, game: gameId, winningGuess }],
    });
    const { res, state } = createMockResponse();

    await updateRound(createMockConfig(database)).handler(
      { params: { id: roundId }, body: { topic: "New topic" } },
      res,
    );

    expect(state.statusCode).toBe(409);
    expect(state.body).toEqual({
      ok: false,
      code: "ROUND_FINALIZED",
      message: "A finalized round cannot be updated",
    });
  });

  it("rejects an empty update", async () => {
    const { res, state } = createMockResponse();

    await updateRound(createMockConfig()).handler({ params: { id: roundId }, body: {} }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: "EMPTY_UPDATE" });
  });
});
