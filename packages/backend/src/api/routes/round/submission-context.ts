import { eq } from "drizzle-orm";
import game from "../../../database/schema/game";
import round from "../../../database/schema/round";
import type { BaseHandlerConfig } from "../../handler";

type Transaction = Parameters<Parameters<BaseHandlerConfig["db"]["transaction"]>[0]>[0];

// Call within the submission transaction so the lock covers validation and writes.
export async function getSubmissionContext(tx: Transaction, roundId: string, userId: string) {
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
  if (roundRow.winningGuess !== null) {
    return { error: "ROUND_FINALIZED" as const };
  }
  return { roundRow, gameRow };
}
