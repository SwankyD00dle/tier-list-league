import { eq } from "drizzle-orm";
import game from "../../../database/schema/game";
import round from "../../../database/schema/round";
import type { BaseHandlerConfig } from "../../handler";

import { advanceExpiredRound } from "./deadlines";

type Transaction = Parameters<Parameters<BaseHandlerConfig["db"]["transaction"]>[0]>[0];

// Keep the lock through authorization, deadline advancement, and the caller's queries.
export async function getRoundContext(tx: Transaction, roundId: string, userId: string) {
  const [roundRow] = await tx
    .select()
    .from(round)
    .where(eq(round.id, roundId))
    .limit(1)
    .for("update");
  if (!roundRow) {
    return { error: "ROUND_NOT_FOUND" as const };
  }
  if (roundRow.game === null) {
    return { error: "PLAYER_NOT_IN_GAME" as const };
  }
  const [gameRow] = await tx
    .select({ participants: game.participants })
    .from(game)
    .where(eq(game.id, roundRow.game))
    .limit(1);
  if (!gameRow?.participants.includes(userId)) {
    return { error: "PLAYER_NOT_IN_GAME" as const };
  }
  const activeRound = await advanceExpiredRound(tx, roundRow, gameRow.participants);
  return { roundRow: activeRound, gameRow };
}

export async function getSubmissionContext(tx: Transaction, roundId: string, userId: string) {
  const context = await getRoundContext(tx, roundId, userId);
  if (context.error !== undefined) return { error: context.error };
  if (context.roundRow.winningGuess !== null) return { error: "ROUND_FINALIZED" as const };
  return context;
}
