import {
  isUpdateRoundRequest,
  type UpdateRoundResponse,
  updateRoundRequestSchema,
  updateRoundResponseSchema,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import round from "../../../database/schema/round";
import { forbiddenResponse } from "../../auth/game-access";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { lockRoundGame } from "./lock";
import { serializeRound } from "./serialize";

export const updateRound = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Update round",
    description: "Update an unfinalized round's topic, host, or end time.",
    tags: ["Round"],
    request: updateRoundRequestSchema,
    response: updateRoundResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<UpdateRoundResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isUpdateRoundRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { topic, hostedBy, endsAt } = req.body;
      if (topic === undefined && hostedBy === undefined && endsAt === undefined) {
        return res.status(400).json({
          ok: false,
          code: "EMPTY_UPDATE",
          message: "Provide at least one field to update",
        });
      }

      const roundId = req.params.id;
      if (endsAt && new Date(endsAt) <= new Date()) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_DEADLINE",
          message: "The deadline must be in the future",
        });
      }

      try {
        const result = await config.db.transaction(async (tx) => {
          const context = await lockRoundGame(tx, roundId);
          if (context.error !== undefined) return { error: "ROUND_NOT_FOUND" as const };
          const { roundRow: existing, gameRow } = context;
          const isAdmin = gameRow.createdBy === auth.sub;
          const isHost = existing.hostedBy === auth.sub && gameRow.participants.includes(auth.sub);
          if (!isAdmin && (!isHost || hostedBy !== undefined || endsAt !== undefined))
            return { forbidden: true };
          if (gameRow.status === "finished") return { error: "GAME_FINISHED" as const };
          if (existing.winningGuess !== null) {
            return { error: "ROUND_FINALIZED" as const };
          }

          if (existing.phase !== "awaiting_host") {
            return { error: "ROUND_STARTED" as const };
          }
          if (hostedBy !== undefined && !gameRow.participants.includes(hostedBy)) {
            return { error: "HOST_NOT_IN_GAME" as const };
          }

          const [updated] = await tx
            .update(round)
            .set({
              ...(topic === undefined ? {} : { topic }),
              ...(hostedBy === undefined ? {} : { hostedBy }),
              ...(endsAt === undefined
                ? {}
                : {
                    endsAt: endsAt === null ? null : new Date(endsAt),
                    guessingDurationMs: gameRow.timeoutDays * 86_400_000,
                  }),
              updatedAt: new Date(),
            })
            .where(eq(round.id, roundId))
            .returning();
          return { updated };
        });

        if ("forbidden" in result) {
          return forbiddenResponse(res);
        }
        if ("error" in result && result.error !== undefined) {
          if (result.error === "GAME_FINISHED")
            return res
              .status(409)
              .json({ ok: false, code: "GAME_FINISHED", message: "The game has finished" });
          if (result.error === "ROUND_NOT_FOUND") {
            return res
              .status(404)
              .json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
          }
          if (result.error === "ROUND_STARTED") {
            return res.status(409).json({
              ok: false,
              code: "ROUND_STARTED",
              message: "Round settings are locked after the host submits",
            });
          }
          if (result.error === "ROUND_FINALIZED") {
            return res.status(409).json({
              ok: false,
              code: "ROUND_FINALIZED",
              message: "A finalized round cannot be updated",
            });
          }
          return res.status(400).json({
            ok: false,
            code: "INVALID_PLAYER",
            message: "The round host must participate in the game",
          });
        }
        if (!result.updated) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to update round",
          });
        }

        return res.status(200).json({ ok: true, round: serializeRound(result.updated) });
      } catch (error) {
        config.log.error({ error: String(error), roundId }, "Update round error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to update round",
        });
      }
    },
  });
