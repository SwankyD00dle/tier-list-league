import { describe, expect, it, vi } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockLogger,
  createMockResponse,
} from "../../../../test-helpers";
import { recordGameScore } from "../create";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const roundId = "550e8400-e29b-41d4-a716-446655440001";
const hostId = "550e8400-e29b-41d4-a716-446655440002";
const winnerId = "550e8400-e29b-41d4-a716-446655440003";
const mentionId = "550e8400-e29b-41d4-a716-446655440004";
const winningGuess = "550e8400-e29b-41d4-a716-446655440005";
const mentionGuess = "550e8400-e29b-41d4-a716-446655440006";

function request(overrides?: { hostedBy?: string; honorableGuess?: string }) {
  return {
    params: { gameId },
    body: {
      round: {
        id: roundId,
        hostedBy: overrides?.hostedBy ?? hostId,
        winningGuess,
        honorableMentions: [
          {
            guessId: overrides?.honorableGuess ?? mentionGuess,
            title: "Answer was completely on point",
          },
        ],
      },
    },
  };
}

describe("recordGameScore", () => {
  it("calculates, replaces, persists, and returns round scores", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T12:00:00.000Z"));
    const database = createMockDb({
      selectResults: [
        [{ participants: [hostId, winnerId, mentionId] }],
        [{ id: roundId, game: gameId, hostedBy: hostId }],
        [
          { id: winningGuess, userId: winnerId },
          { id: mentionGuess, userId: mentionId },
        ],
        [
          {
            roundId,
            userId: winnerId,
            score: 3,
            reason: "Host declared user the winner",
          },
          {
            roundId,
            userId: mentionId,
            score: 1,
            reason: 'Host declared user an honorable mention for "Answer was completely on point"',
          },
        ],
      ],
    });
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(database)).handler(request(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      round: {
        id: roundId,
        winningGuess,
        honorableMentions: [{ guessId: mentionGuess, title: "Answer was completely on point" }],
        scoreDeltas: {
          [winnerId]: {
            score: 3,
            entries: [{ score: 3, reason: "Host declared user the winner" }],
          },
          [mentionId]: {
            score: 1,
            entries: [
              {
                score: 1,
                reason:
                  'Host declared user an honorable mention for "Answer was completely on point"',
              },
            ],
          },
        },
      },
      scores: {
        [hostId]: { total: 0, rounds: {} },
        [winnerId]: {
          total: 3,
          rounds: {
            [roundId]: {
              score: 3,
              entries: [{ score: 3, reason: "Host declared user the winner" }],
            },
          },
        },
        [mentionId]: {
          total: 1,
          rounds: {
            [roundId]: {
              score: 1,
              entries: [
                {
                  score: 1,
                  reason:
                    'Host declared user an honorable mention for "Answer was completely on point"',
                },
              ],
            },
          },
        },
      },
    });
    expect(database.transaction).toHaveBeenCalledOnce();
    expect(database.delete).toHaveBeenCalledOnce();
    expect(database.insert).toHaveBeenCalledOnce();
    expect(database.update).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("rejects duplicate awards before writing", async () => {
    const database = createMockDb();
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(database)).handler(
      request({ honorableGuess: winningGuess }),
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      ok: false,
      code: "DUPLICATE_AWARD",
      message: "A guess can only receive one award per round",
    });
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("allows only the recorded round host to score", async () => {
    const database = createMockDb({
      selectResults: [
        [{ participants: [hostId, winnerId, mentionId] }],
        [{ id: roundId, game: gameId, hostedBy: hostId }],
      ],
    });
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(database)).handler(request({ hostedBy: winnerId }), res);

    expect(state.statusCode).toBe(403);
    expect(state.body).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Only the round host can record scores",
    });
  });

  it("validates the request shape", async () => {
    const log = createMockLogger();
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(createMockDb(), log)).handler(
      { params: { gameId }, body: { round: { id: "bad" } } },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: REQUEST_SCHEMA_FAILURE_CODE });
    expect(log.error).not.toHaveBeenCalled();
  });
});
