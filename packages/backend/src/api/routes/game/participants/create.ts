import { eq, sql } from "drizzle-orm";
import game from "../../../../database/schema/game";
import user from "../../../../database/schema/user";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../../route-helper";
import {
  addParticipantRequestSchema,
  type ParticipantsResponse,
  participantsResponseSchema,
} from "./schema";

export const addParticipant = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Add game participant",
    description: "Enroll an existing user in a game.",
    tags: ["Game"],
    request: addParticipantRequestSchema,
    response: participantsResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ParticipantsResponse>) => {
      const parsed = addParticipantRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const { gameId } = parsed.data.params;
      const { userId } = parsed.data.body;

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
          if (gameRow.participants.includes(userId)) {
            return { error: "ALREADY_PARTICIPANT" as const };
          }

          const [userRow] = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);
          if (!userRow) {
            return { error: "USER_NOT_FOUND" as const };
          }

          const participants = [...gameRow.participants, userId];
          await tx
            .update(game)
            .set({ participants, updatedAt: new Date() })
            .where(eq(game.id, gameId));
          await tx
            .update(user)
            .set({ activeGames: sql`array_append(${user.activeGames}, ${gameId}::uuid)` })
            .where(eq(user.id, userId));

          return { participants };
        });

        if ("error" in result && result.error !== undefined) {
          return participantErrorResponse(res, result.error);
        }
        if (!result.participants) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to add participant",
          });
        }

        return res.status(200).json({ ok: true, gameId, participants: result.participants });
      } catch (error) {
        config.log.error({ error: String(error), gameId, userId }, "Add participant error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to add participant",
        });
      }
    },
  });

function participantErrorResponse(
  res: ApiResponse<ParticipantsResponse>,
  error: "GAME_NOT_FOUND" | "ALREADY_PARTICIPANT" | "USER_NOT_FOUND",
) {
  switch (error) {
    case "GAME_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
    case "USER_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });
    case "ALREADY_PARTICIPANT":
      return res.status(409).json({
        ok: false,
        code: "ALREADY_PARTICIPANT",
        message: "User already participates in this game",
      });
  }
}
