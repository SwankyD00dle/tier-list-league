import {
  type GetGameResponse,
  getGameRequestSchema,
  getGameResponseSchema,
  isGetGameRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import { forbiddenResponse } from "../../auth/game-access";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { serializeGame } from "./serialize";

export const getGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get game",
    description: "Get a single game by id.",
    tags: ["Game"],
    request: getGameRequestSchema,
    response: getGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetGameResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isGetGameRequest(req)) {
        return requestSchemaFailure(res);
      }

      const [found] = await getGameFromDb(config.db, req.params.id);
      if (!found) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      if (!found.participants.includes(auth.sub)) {
        return forbiddenResponse(res);
      }

      return res.status(200).json({
        ok: true,
        game: serializeGame(found),
      });
    },
  });

function getGameFromDb(database: typeof db, id: string) {
  return database.select().from(game).where(eq(game.id, id)).limit(1);
}
