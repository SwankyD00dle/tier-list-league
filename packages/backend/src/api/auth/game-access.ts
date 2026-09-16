import { eq } from "drizzle-orm";
import game from "../../database/schema/game";
import type { BaseHandlerConfig } from "../handler";
import type { ApiResponse } from "../route-helper";

export function forbiddenResponse(res: ApiResponse<unknown>) {
  return res.status(403).json({
    ok: false,
    code: "FORBIDDEN",
    message: "You do not have permission for this action",
  });
}

export async function hasGameRole(
  database: Pick<BaseHandlerConfig["db"], "select">,
  gameId: string | null,
  userId: string,
  role: "admin" | "participant",
) {
  if (gameId === null) {
    return false;
  }
  const [found] = await database
    .select({ createdBy: game.createdBy, participants: game.participants })
    .from(game)
    .where(eq(game.id, gameId))
    .limit(1);
  return (
    !!found && (role === "admin" ? found.createdBy === userId : found.participants.includes(userId))
  );
}
