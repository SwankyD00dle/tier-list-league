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
import { serializeGame } from "./serialize";

export const updateGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Update game",
    description: "Update lobby game details, ending condition, or timeout.",
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

      const { name, description, roundCount, pointsTarget, timeoutDays } = req.body;
      if (
        [name, description, roundCount, pointsTarget, timeoutDays].every(
          (value) => value === undefined,
        )
      ) {
        return res.status(400).json({
          ok: false,
          code: "EMPTY_UPDATE",
          message: "Provide at least one field to update",
        });
      }

      try {
        const result = await config.db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(game)
            .where(eq(game.id, req.params.id))
            .limit(1)
            .for("update");
          if (!existing) return { error: "NOT_FOUND" as const };
          if (existing.createdBy !== auth.sub) return { error: "FORBIDDEN" as const };
          if (existing.status !== "lobby") return { error: "GAME_STARTED" as const };
          const [updated] = await tx
            .update(game)
            .set({
              name,
              description,
              roundCount,
              pointsTarget,
              timeoutDays,
              updatedAt: new Date(),
            })
            .where(eq(game.id, req.params.id))
            .returning();
          if (!updated) throw new Error("Game update returned no row");
          return { updated };
        });
        if (result.error === "FORBIDDEN") return forbiddenResponse(res);
        if (result.error === "NOT_FOUND")
          return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
        if (result.error === "GAME_STARTED")
          return res.status(409).json({
            ok: false,
            code: "GAME_STARTED",
            message: "Game settings lock when the first round starts",
          });
        if (!result.updated) throw new Error("Game update returned no row");
        return res.status(200).json({ ok: true, game: serializeGame(result.updated) });
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
