import {
  isUpdateGameRequest,
  type UpdateGameResponse,
  updateGameRequestSchema,
  updateGameResponseSchema,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
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

export const updateGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Update game",
    description: "Update a game's name, description, or round count.",
    tags: ["Game"],
    request: updateGameRequestSchema,
    response: updateGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<UpdateGameResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isUpdateGameRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { name, description, roundCount } = req.body;
      if (name === undefined && description === undefined && roundCount === undefined) {
        return res.status(400).json({
          ok: false,
          code: "EMPTY_UPDATE",
          message: "Provide at least one field to update",
        });
      }

      try {
        const [existing] = await config.db
          .select({ createdBy: game.createdBy })
          .from(game)
          .where(eq(game.id, req.params.id))
          .limit(1);
        if (!existing) {
          return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
        }
        if (existing.createdBy !== auth.sub) {
          return forbiddenResponse(res);
        }
        const [updated] = await config.db
          .update(game)
          .set({
            ...(name === undefined ? {} : { name }),
            ...(description === undefined ? {} : { description }),
            ...(roundCount === undefined ? {} : { roundCount }),
            updatedAt: new Date(),
          })
          .where(eq(game.id, req.params.id))
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
