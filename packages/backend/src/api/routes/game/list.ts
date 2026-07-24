import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../route-helper";
import { type ListGamesResponse, listGamesRequestSchema, listGamesResponseSchema } from "./schema";

export const listGames = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "List games",
    description: "List all games.",
    tags: ["Game"],
    request: listGamesRequestSchema,
    response: listGamesResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ListGamesResponse>) => {
      const parsed = listGamesRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
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
