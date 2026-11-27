import type { BaseHandlerConfig } from "../../handler";
import { advanceExpiredRound } from "./deadlines";
import { lockRoundGame } from "./lock";

type Transaction = Parameters<Parameters<BaseHandlerConfig["db"]["transaction"]>[0]>[0];

// Keep the lock through authorization, deadline advancement, and the caller's queries.
export async function getRoundContext(tx: Transaction, roundId: string, userId: string) {
  const context = await lockRoundGame(tx, roundId);
  if (context.error !== undefined) return { error: context.error };
  const { gameRow, roundRow } = context;
  if (!gameRow.participants.includes(userId)) return { error: "PLAYER_NOT_IN_GAME" as const };
  const activeRound = await advanceExpiredRound(tx, roundRow, gameRow.participants);
  return { roundRow: activeRound, gameRow };
}

export async function getSubmissionContext(tx: Transaction, roundId: string, userId: string) {
  const context = await getRoundContext(tx, roundId, userId);
  if (context.error !== undefined) return { error: context.error };
  if (context.gameRow.status === "finished") return { error: "GAME_FINISHED" as const };
  if (context.roundRow.winningGuess !== null) return { error: "ROUND_FINALIZED" as const };
  return context;
}
