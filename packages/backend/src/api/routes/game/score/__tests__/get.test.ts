import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../../route-helper";
import {
  authenticatedRequest,
  createMockConfig,
  createMockDb,
  createMockResponse,
} from "../../../../test-helpers";
import { getGameScores, getUserGameScore } from "../get";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const roundId = "550e8400-e29b-41d4-a716-446655440001";
const user1 = "550e8400-e29b-41d4-a716-446655440002";
const user2 = "550e8400-e29b-41d4-a716-446655440003";

describe("score reads", () => {
  it("returns scores keyed by every participant id", async () => {
    const database = createMockDb({
      selectResults: [
        [{ participants: [user1, user2] }],
        [{ roundId, userId: user1, score: 3, reason: "Host declared user the winner" }],
      ],
    });
    const { res, state } = createMockResponse();

    await getGameScores(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { gameId } }, user1),
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      scores: {
        [user1]: {
          total: 3,
          rounds: {
            [roundId]: {
              score: 3,
              entries: [{ score: 3, reason: "Host declared user the winner" }],
            },
          },
        },
        [user2]: { total: 0, rounds: {} },
      },
    });
  });

  it("returns one participant's running score", async () => {
    const database = createMockDb({
      selectResults: [
        [{ participants: [user1] }],
        [{ roundId, userId: user1, score: 1, reason: "Honorable mention" }],
      ],
    });
    const { res, state } = createMockResponse();

    await getUserGameScore(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { gameId, userId: user1 } }, user1),
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      userId: user1,
      score: {
        total: 1,
        rounds: {
          [roundId]: {
            score: 1,
            entries: [{ score: 1, reason: "Honorable mention" }],
          },
        },
      },
    });
  });

  it("returns 404 when the user is not a game participant", async () => {
    const database = createMockDb({ selectResult: [{ participants: [user1] }] });
    const { res, state } = createMockResponse();

    await getUserGameScore(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { gameId, userId: user2 } }, user1),
      res,
    );

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Player not found in game",
    });
  });

  it("validates game and user ids", async () => {
    const { res, state } = createMockResponse();

    await getUserGameScore(createMockConfig()).handler(
      await authenticatedRequest({ params: { gameId: "bad", userId: "bad" } }, user1),
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: REQUEST_SCHEMA_FAILURE_CODE });
  });
});
