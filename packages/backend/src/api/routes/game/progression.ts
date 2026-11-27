import { randomInt, randomUUID } from "node:crypto";
import type { GameScores } from "@tier-list-league/api-schema/types";
import { eq } from "drizzle-orm";
import type { Transaction } from "../../../database/client";
import game, { type Game } from "../../../database/schema/game";
import round, { type Round } from "../../../database/schema/round";
import user from "../../../database/schema/user";

export function chooseNextHost(
  parent: Game,
  history: Round[],
  winner: string,
  previousWins: number,
) {
  const counts = new Map(parent.participants.map((id) => [id, 0]));
  for (const item of history) {
    if (item.phase === "finalized" && item.hostedBy && counts.has(item.hostedBy)) {
      counts.set(item.hostedBy, (counts.get(item.hostedBy) ?? 0) + 1);
    }
  }
  const eligible = parent.participants.filter(
    (id) => parent.pointsTarget !== null || (counts.get(id) ?? 0) < parent.roundCount,
  );
  const unhosted = eligible.filter((id) => counts.get(id) === 0);
  if (eligible.includes(winner) && !(previousWins > 0 && unhosted.length > 0)) return winner;
  const candidates = unhosted.length > 0 ? unhosted : eligible;
  return candidates.length > 0 ? candidates[randomInt(candidates.length)] : null;
}

export function gameWinners(parent: Game, history: Round[], scores: GameScores): string[] {
  const totals = parent.participants.map((id) => scores[id]?.total ?? 0);
  const top = Math.max(0, ...totals);
  const complete =
    parent.pointsTarget !== null
      ? top >= parent.pointsTarget
      : parent.participants.every(
          (id) =>
            history.filter((item) => item.phase === "finalized" && item.hostedBy === id).length >=
            parent.roundCount,
        );
  if (!complete || parent.participants.length === 0) return [];
  return parent.participants.filter((id) => (scores[id]?.total ?? 0) === top);
}

export async function progressGame(
  tx: Transaction,
  parent: Game,
  completed: Round,
  winner: string,
  scores: GameScores,
) {
  const history = await tx.select().from(round).where(eq(round.game, parent.id));
  const winnerIds = gameWinners(parent, history, scores);
  const now = new Date();
  if (winnerIds.length > 0) {
    const [finished] = await tx
      .update(game)
      .set({ status: "finished", winnerIds, finishedAt: now, updatedAt: now })
      .where(eq(game.id, parent.id))
      .returning();
    if (!finished) throw new Error("Game finalization returned no row");
    // Serialize per-user updates across games to preserve concurrent membership changes.
    for (const userId of [...parent.participants].sort()) {
      const [player] = await tx
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .for("update");
      if (player)
        await tx
          .update(user)
          .set({ activeGames: player.activeGames.filter((id) => id !== parent.id) })
          .where(eq(user.id, userId));
    }
    return { game: finished, nextRound: null };
  }
  const previousWins = history
    .filter((item) => item.id !== completed.id && item.winningGuess !== null)
    .filter((item) =>
      (scores[winner]?.rounds[item.id]?.entries ?? []).some((entry) => entry.score === 3),
    ).length;
  const hostedBy = chooseNextHost(parent, history, winner, previousWins);
  if (!hostedBy) throw new Error("An unfinished game must have an eligible next host");
  const [nextRound] = await tx
    .insert(round)
    .values({
      id: randomUUID(),
      game: parent.id,
      roundNumber: Math.max(0, ...history.map((item) => item.roundNumber)) + 1,
      topic: completed.topic,
      hostedBy,
      guessingDurationMs: parent.timeoutDays * 86_400_000,
    })
    .returning();
  if (!nextRound) throw new Error("Next round creation returned no row");
  const [updated] = await tx
    .update(game)
    .set({ status: "active", rounds: [...parent.rounds, nextRound.id], updatedAt: now })
    .where(eq(game.id, parent.id))
    .returning();
  if (!updated) throw new Error("Game progression returned no row");
  return { game: updated, nextRound };
}
