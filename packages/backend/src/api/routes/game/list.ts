import {
  isListGamesRequest,
  type ListGamesResponse,
  listGamesRequestSchema,
  listGamesResponseSchema,
} from "@tier-list-league/api-schema";
import { arrayContains, eq, or } from "drizzle-orm";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { serializeGame } from "./serialize";

export const listGames = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "List games",
    description: "List games administered by or containing the authenticated user.",
    tags: ["Game"],
    request: listGamesRequestSchema,
    response: listGamesResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ListGamesResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isListGamesRequest(req)) {
        return requestSchemaFailure(res);
      }

      const games = await listGamesFromDb(config.db, auth.sub);
      return res.status(200).json({
        ok: true,
        games: games.map(serializeGame),
      });
    },
  });

function listGamesFromDb(database: typeof db, userId: string) {
  return database
    .select()
    .from(game)
    .where(or(eq(game.createdBy, userId), arrayContains(game.participants, [userId])));
}
