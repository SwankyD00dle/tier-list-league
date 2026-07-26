import {
  isRemoveParticipantRequest,
  type ParticipantsResponse,
  participantsResponseSchema,
  removeParticipantRequestSchema,
} from "@tier-list-league/api-schema";
import { eq, sql } from "drizzle-orm";
import game from "../../../../database/schema/game";
import user from "../../../../database/schema/user";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../../route-helper";

export const removeParticipant = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Remove game participant",
    description: "Remove a user from a game. Historical score entries are kept.",
    tags: ["Game"],
    request: removeParticipantRequestSchema,
    response: participantsResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ParticipantsResponse>) => {
      if (!isRemoveParticipantRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { gameId, userId } = req.params;

      try {
        const result = await config.db.transaction(async (tx) => {
          const [gameRow] = await tx
            .select({ participants: game.participants })
            .from(game)
            .where(eq(game.id, gameId))
            .limit(1);
          if (!gameRow) {
            return { error: "GAME_NOT_FOUND" as const };
          }
          if (!gameRow.participants.includes(userId)) {
            return { error: "NOT_PARTICIPANT" as const };
          }

          const participants = gameRow.participants.filter(
            (participantId) => participantId !== userId,
          );
          await tx
            .update(game)
            .set({ participants, updatedAt: new Date() })
            .where(eq(game.id, gameId));
          await tx
            .update(user)
            .set({ activeGames: sql`array_remove(${user.activeGames}, ${gameId}::uuid)` })
            .where(eq(user.id, userId));

          return { participants };
        });

        if ("error" in result && result.error !== undefined) {
          if (result.error === "GAME_NOT_FOUND") {
            return res
              .status(404)
              .json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
          }
          return res.status(404).json({
            ok: false,
            code: "NOT_FOUND",
            message: "User does not participate in this game",
          });
        }
        if (!result.participants) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to remove participant",
          });
        }

        return res.status(200).json({ ok: true, gameId, participants: result.participants });
      } catch (error) {
        config.log.error({ error: String(error), gameId, userId }, "Remove participant error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to remove participant",
        });
      }
    },
  });
