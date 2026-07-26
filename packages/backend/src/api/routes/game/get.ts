import {
  type GetGameResponse,
  getGameRequestSchema,
  getGameResponseSchema,
  isGetGameRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const getGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get game",
    description: "Get a single game by id.",
    tags: ["Game"],
    request: getGameRequestSchema,
    response: getGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetGameResponse>) => {
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

      return res.status(200).json({
        ok: true,
        game: {
          id: found.id,
          name: found.name,
          description: found.description,
          participants: found.participants,
          roundCount: found.roundCount,
          rounds: found.rounds,
          createdBy: found.createdBy,
          createdAt: found.createdAt.toISOString(),
          updatedAt: found.updatedAt.toISOString(),
        },
      });
    },
  });

function getGameFromDb(database: typeof db, id: string) {
  return database
    .select({
      id: game.id,
      name: game.name,
      description: game.description,
      participants: game.participants,
      roundCount: game.roundCount,
      rounds: game.rounds,
      createdBy: game.createdBy,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    })
    .from(game)
    .where(eq(game.id, id))
    .limit(1);
}
