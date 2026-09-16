import { describe, expect, it } from "vitest";
import {
  authenticatedRequest,
  createMockConfig,
  createMockDb,
  createMockResponse,
} from "../../../../test-helpers";
import { submitTierList } from "../create";

const roundId = "550e8400-e29b-41d4-a716-446655440000";
const gameId = "550e8400-e29b-41d4-a716-446655440001";
const hostId = "550e8400-e29b-41d4-a716-446655440002";
const playerId = "550e8400-e29b-41d4-a716-446655440003";
const tierListId = "550e8400-e29b-41d4-a716-446655440004";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const data = { SS: [playerId], S: [], A: [], B: [], C: [], D: [], E: [], F: [] };

describe("submitTierList", () => {
  it("stores the host submission as the round's canonical tier list", async () => {
    const database = createMockDb({
      selectResults: [
        [
          {
            game: gameId,
            hostedBy: hostId,
            tierList: null,
            participantTierLists: null,
            winningGuess: null,
          },
        ],
        [{ participants: [hostId, playerId] }],
      ],
      insertResult: [{ id: tierListId, createdBy: hostId, data, createdAt, updatedAt: createdAt }],
    });
    const { res, state } = createMockResponse();

    await submitTierList(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId }, body: { userId: hostId, data } }, hostId),
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toMatchObject({ ok: true, role: "host", tierList: { id: tierListId } });
  });

  it("stores a participant submission and returns 201", async () => {
    const database = createMockDb({
      selectResults: [
        [
          {
            game: gameId,
            hostedBy: hostId,
            tierList: null,
            participantTierLists: [],
            winningGuess: null,
          },
        ],
        [{ participants: [hostId, playerId] }],
      ],
      insertResult: [
        { id: tierListId, createdBy: playerId, data, createdAt, updatedAt: createdAt },
      ],
    });
    const { res, state } = createMockResponse();

    await submitTierList(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId: playerId, data } },
        playerId,
      ),
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toMatchObject({ ok: true, role: "participant" });
  });

  it("updates an existing participant tier list and returns 200", async () => {
    const database = createMockDb({
      selectResults: [
        [
          {
            game: gameId,
            hostedBy: hostId,
            tierList: null,
            participantTierLists: [tierListId],
            winningGuess: null,
          },
        ],
        [{ participants: [hostId, playerId] }],
        [{ id: tierListId }],
      ],
      updateResult: [
        { id: tierListId, createdBy: playerId, data, createdAt, updatedAt: createdAt },
      ],
    });
    const { res, state } = createMockResponse();

    await submitTierList(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId: playerId, data } },
        playerId,
      ),
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true, role: "participant" });
  });

  it("rejects submissions on a finalized round", async () => {
    const database = createMockDb({
      selectResults: [
        [
          {
            game: gameId,
            hostedBy: hostId,
            tierList: null,
            participantTierLists: null,
            winningGuess: tierListId,
          },
        ],
        [{ participants: [hostId, playerId] }],
      ],
    });
    const { res, state } = createMockResponse();

    await submitTierList(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId: playerId, data } },
        playerId,
      ),
      res,
    );

    expect(state.statusCode).toBe(409);
    expect(state.body).toMatchObject({ ok: false, code: "ROUND_FINALIZED" });
  });
});
