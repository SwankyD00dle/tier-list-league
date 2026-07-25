import type { RoundScoreDeltas } from "../../../../database/schema/round";
import type { GameScores, PlayerScore } from "./schema";

export const WINNER_SCORE = 3;
export const HONORABLE_MENTION_SCORE = 1;

export interface ScoredGuess {
  id: string;
  userId: string;
}

export interface HonorableMentionAward extends ScoredGuess {
  title: string;
}

export interface ScoreEntryRow {
  roundId: string;
  userId: string;
  score: number;
  reason: string;
}

export interface NewScoreEntry {
  game: string;
  round: string;
  user: string;
  guess: string;
  kind: "winner" | "honorable_mention";
  score: number;
  reason: string;
}

export function buildRoundScoreEntries(
  gameId: string,
  roundId: string,
  winner: ScoredGuess,
  honorableMentions: HonorableMentionAward[],
): NewScoreEntry[] {
  return [
    {
      game: gameId,
      round: roundId,
      user: winner.userId,
      guess: winner.id,
      kind: "winner",
      score: WINNER_SCORE,
      reason: "Host declared user the winner",
    },
    ...honorableMentions.map((mention) => ({
      game: gameId,
      round: roundId,
      user: mention.userId,
      guess: mention.id,
      kind: "honorable_mention" as const,
      score: HONORABLE_MENTION_SCORE,
      reason: `Host declared user an honorable mention for "${mention.title}"`,
    })),
  ];
}

export function aggregateGameScores(
  participantIds: string[],
  entries: ScoreEntryRow[],
): GameScores {
  const scores: GameScores = Object.fromEntries(
    participantIds.map((participantId) => [participantId, emptyPlayerScore()]),
  );

  for (const entry of entries) {
    const player = scores[entry.userId] ?? emptyPlayerScore();
    const round = player.rounds[entry.roundId] ?? { score: 0, entries: [] };

    round.score += entry.score;
    round.entries.push({ score: entry.score, reason: entry.reason });
    player.total += entry.score;
    player.rounds[entry.roundId] = round;
    scores[entry.userId] = player;
  }

  return scores;
}

export function aggregateRoundScoreDeltas(entries: ScoreEntryRow[]): RoundScoreDeltas {
  const scores = aggregateGameScores([], entries);
  const deltas: RoundScoreDeltas = {};

  for (const [userId, score] of Object.entries(scores)) {
    const [round] = Object.values(score.rounds);
    if (round) {
      deltas[userId] = round;
    }
  }

  return deltas;
}

function emptyPlayerScore(): PlayerScore {
  return { total: 0, rounds: {} };
}
