import { eq } from "drizzle-orm";
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
import { type GetGameResponse, getGameRequestSchema, getGameResponseSchema } from "./schema";

export const getGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get game",
    description: "Get a single game by id.",
    tags: ["Game"],
    request: getGameRequestSchema,
    response: getGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetGameResponse>) => {
      const parsed = getGameRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const [found] = await getGameFromDb(config.db, parsed.data.params.id);
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
