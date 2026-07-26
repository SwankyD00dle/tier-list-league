import {
  isUpdateRoundRequest,
  type UpdateRoundResponse,
  updateRoundRequestSchema,
  updateRoundResponseSchema,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import game from "../../../database/schema/game";
import round from "../../../database/schema/round";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { serializeRound } from "./serialize";

export const updateRound = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Update round",
    description: "Update an unfinalized round's topic, host, or end time.",
    tags: ["Round"],
    request: updateRoundRequestSchema,
    response: updateRoundResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<UpdateRoundResponse>) => {
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
      try {
        const result = await config.db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ id: round.id, game: round.game, winningGuess: round.winningGuess })
            .from(round)
            .where(eq(round.id, roundId))
            .limit(1);
          if (!existing) {
            return { error: "ROUND_NOT_FOUND" as const };
          }
          if (existing.winningGuess !== null) {
            return { error: "ROUND_FINALIZED" as const };
          }

          if (hostedBy !== undefined) {
            if (existing.game === null) {
              return { error: "HOST_NOT_IN_GAME" as const };
            }
            const [gameRow] = await tx
              .select({ participants: game.participants })
              .from(game)
              .where(eq(game.id, existing.game))
              .limit(1);
            if (!gameRow?.participants.includes(hostedBy)) {
              return { error: "HOST_NOT_IN_GAME" as const };
            }
          }

          const [updated] = await tx
            .update(round)
            .set({
              ...(topic === undefined ? {} : { topic }),
              ...(hostedBy === undefined ? {} : { hostedBy }),
              ...(endsAt === undefined
                ? {}
                : { endsAt: endsAt === null ? null : new Date(endsAt) }),
              updatedAt: new Date(),
            })
            .where(eq(round.id, roundId))
            .returning();
          return { updated };
        });

        if ("error" in result && result.error !== undefined) {
          if (result.error === "ROUND_NOT_FOUND") {
            return res
              .status(404)
              .json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
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
