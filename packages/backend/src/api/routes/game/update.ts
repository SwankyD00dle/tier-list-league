import { eq } from "drizzle-orm";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../route-helper";
import {
  type UpdateGameResponse,
  updateGameRequestSchema,
  updateGameResponseSchema,
} from "./schema";

export const updateGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Update game",
    description: "Update a game's name, description, or round count.",
    tags: ["Game"],
    request: updateGameRequestSchema,
    response: updateGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<UpdateGameResponse>) => {
      const parsed = updateGameRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const { name, description, roundCount } = parsed.data.body;
      if (name === undefined && description === undefined && roundCount === undefined) {
        return res.status(400).json({
          ok: false,
          code: "EMPTY_UPDATE",
          message: "Provide at least one field to update",
        });
      }

      try {
        const [updated] = await config.db
          .update(game)
          .set({
            ...(name === undefined ? {} : { name }),
            ...(description === undefined ? {} : { description }),
            ...(roundCount === undefined ? {} : { roundCount }),
            updatedAt: new Date(),
          })
          .where(eq(game.id, parsed.data.params.id))
          .returning();
        if (!updated) {
          return res.status(404).json({
            ok: false,
            code: "NOT_FOUND",
            message: "Game not found",
          });
        }

        return res.status(200).json({
          ok: true,
          game: {
            id: updated.id,
            name: updated.name,
            description: updated.description,
            participants: updated.participants,
            roundCount: updated.roundCount,
            rounds: updated.rounds,
            createdBy: updated.createdBy,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        config.log.error({ error: String(error) }, "Update game error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to update game",
        });
      }
    },
  });
