import { describe, expect, it, vi } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../../route-helper";
import {
  authenticatedRequest,
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
  it("finalizes scores and the game at the points target", async () => {
    const phase = "judging";
    const gameRow = {
      id: gameId,
      name: "Test",
      description: "",
      status: "active",
      pointsTarget: 3,
      timeoutDays: 1,
      roundCount: 1,
      rounds: [roundId],
      winnerIds: [],
      finishedAt: null,
      createdBy: hostId,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [
        hostId,
        winnerId,
        mentionId,
        ...Array.from(
          { length: 7 },
          (_, index) => `550e8400-e29b-41d4-a716-4466554400${10 + index}`,
        ),
      ],
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T12:00:00.000Z"));
    const updates: unknown[] = [];
    const database = createMockDb({
      onUpdateSet: (values) => updates.push(values),
      updateResult: [
        { ...gameRow, status: "finished", winnerIds: [winnerId], finishedAt: new Date() },
      ],
      selectResults: [
        [gameRow],
        [{ id: roundId, game: gameId, hostedBy: hostId, phase }],
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

    await recordGameScore(createMockConfig(database)).handler(
      await authenticatedRequest(request(), hostId),
      res,
    );

    expect(updates).toContainEqual(
      expect.objectContaining({ phase: "finalized", pendingGuessers: [] }),
    );
    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
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
    expect(database.insert).toHaveBeenCalledTimes(2);
    expect(database.update).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("rejects duplicate awards before writing", async () => {
    const database = createMockDb();
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(database)).handler(
      await authenticatedRequest(request({ honorableGuess: winningGuess }), hostId),
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
        [{ id: roundId, game: gameId, hostedBy: hostId, phase: "judging" }],
      ],
    });
    const { res, state } = createMockResponse();

    await recordGameScore(createMockConfig(database)).handler(
      await authenticatedRequest(request({ hostedBy: winnerId }), winnerId),
      res,
    );

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
      await authenticatedRequest({ params: { gameId }, body: { round: { id: "bad" } } }, hostId),
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: REQUEST_SCHEMA_FAILURE_CODE });
    expect(log.error).not.toHaveBeenCalled();
  });
});

it.each(["awaiting_host", "guessing"])("rejects scoring during %s", async (phase) => {
  const database = createMockDb({
    selectResults: [
      [{ participants: [hostId, winnerId] }],
      [{ id: roundId, game: gameId, hostedBy: hostId, phase }],
    ],
  });
  const { res, state } = createMockResponse();
  await recordGameScore(createMockConfig(database)).handler(
    await authenticatedRequest(request(), hostId),
    res,
  );
  expect(state.statusCode).toBe(409);
  expect(state.body).toMatchObject({ code: "INVALID_PHASE" });
  expect(database.insert).not.toHaveBeenCalled();
});
