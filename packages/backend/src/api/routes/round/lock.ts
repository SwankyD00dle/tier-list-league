import { eq } from "drizzle-orm";
import type { Transaction } from "../../../database/client";
import game from "../../../database/schema/game";
import round from "../../../database/schema/round";

// Every gameplay mutation locks the game before its round to avoid lock inversion.
export async function lockRoundGame(tx: Transaction, roundId: string) {
  const [reference] = await tx
    .select({ game: round.game })
    .from(round)
    .where(eq(round.id, roundId))
    .limit(1);
  if (!reference) return { error: "ROUND_NOT_FOUND" as const };
  if (!reference.game) return { error: "PLAYER_NOT_IN_GAME" as const };
  const [gameRow] = await tx
    .select()
    .from(game)
    .where(eq(game.id, reference.game))
    .limit(1)
    .for("update");
  if (!gameRow) return { error: "PLAYER_NOT_IN_GAME" as const };
  const [roundRow] = await tx
    .select()
    .from(round)
    .where(eq(round.id, roundId))
    .limit(1)
    .for("update");
  if (!roundRow) return { error: "ROUND_NOT_FOUND" as const };
  return { gameRow, roundRow };
}
