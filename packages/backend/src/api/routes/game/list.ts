import {
  isListGamesRequest,
  type ListGamesResponse,
  listGamesRequestSchema,
  listGamesResponseSchema,
} from "@tier-list-league/api-schema";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const listGames = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "List games",
    description: "List all games.",
    tags: ["Game"],
    request: listGamesRequestSchema,
    response: listGamesResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ListGamesResponse>) => {
      if (!isListGamesRequest(req)) {
        return requestSchemaFailure(res);
      }

      const games = await listGamesFromDb(config.db);
      return res.status(200).json({
        ok: true,
        games: games.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          participants: row.participants,
          roundCount: row.roundCount,
          rounds: row.rounds,
          createdBy: row.createdBy,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      });
    },
  });

function listGamesFromDb(database: typeof db) {
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
    .from(game);
}
