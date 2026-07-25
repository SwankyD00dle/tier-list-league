import { describe, expect, it } from "vitest";
import {
  aggregateGameScores,
  aggregateRoundScoreDeltas,
  buildRoundScoreEntries,
  HONORABLE_MENTION_SCORE,
  WINNER_SCORE,
} from "../service";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const round1 = "550e8400-e29b-41d4-a716-446655440001";
const round2 = "550e8400-e29b-41d4-a716-446655440002";
const user1 = "550e8400-e29b-41d4-a716-446655440003";
const user2 = "550e8400-e29b-41d4-a716-446655440004";
const user3 = "550e8400-e29b-41d4-a716-446655440005";
const guess1 = "550e8400-e29b-41d4-a716-446655440006";
const guess2 = "550e8400-e29b-41d4-a716-446655440007";

const rows = [
  { roundId: round1, userId: user1, score: 3, reason: "Winner" },
  { roundId: round1, userId: user1, score: 1, reason: "On point" },
  { roundId: round1, userId: user2, score: 1, reason: "Funny" },
  { roundId: round2, userId: user1, score: 1, reason: "Creative" },
];

describe("score service", () => {
  it("owns point calculation and creates human-readable reasons", () => {
    expect(WINNER_SCORE).toBe(3);
    expect(HONORABLE_MENTION_SCORE).toBe(1);

    expect(
      buildRoundScoreEntries(gameId, round1, { id: guess1, userId: user1 }, [
        { id: guess2, userId: user2, title: "Completely on point" },
      ]),
    ).toEqual([
      {
        game: gameId,
        round: round1,
        user: user1,
        guess: guess1,
        kind: "winner",
        score: 3,
        reason: "Host declared user the winner",
      },
      {
        game: gameId,
        round: round1,
        user: user2,
        guess: guess2,
        kind: "honorable_mention",
        score: 1,
        reason: 'Host declared user an honorable mention for "Completely on point"',
      },
    ]);
  });

  it("aggregates totals, per-round deltas, multiple reasons, and zero-score players", () => {
    expect(aggregateGameScores([user1, user2, user3], rows)).toEqual({
      [user1]: {
        total: 5,
        rounds: {
          [round1]: {
            score: 4,
            entries: [
              { score: 3, reason: "Winner" },
              { score: 1, reason: "On point" },
            ],
          },
          [round2]: {
            score: 1,
            entries: [{ score: 1, reason: "Creative" }],
          },
        },
      },
      [user2]: {
        total: 1,
        rounds: {
          [round1]: {
            score: 1,
            entries: [{ score: 1, reason: "Funny" }],
          },
        },
      },
      [user3]: { total: 0, rounds: {} },
    });
  });

  it("builds the score delta stored on a finalized round", () => {
    expect(aggregateRoundScoreDeltas(rows.filter(({ roundId }) => roundId === round1))).toEqual({
      [user1]: {
        score: 4,
        entries: [
          { score: 3, reason: "Winner" },
          { score: 1, reason: "On point" },
        ],
      },
      [user2]: {
        score: 1,
        entries: [{ score: 1, reason: "Funny" }],
      },
    });
  });
});
