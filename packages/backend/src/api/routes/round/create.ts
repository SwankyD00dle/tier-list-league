import { randomUUID } from "node:crypto";
import {
  type CreateRoundResponse,
  createRoundRequestSchema,
  createRoundResponseSchema,
  isCreateRoundRequest,
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

export const createRound = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Create round",
    description: "Create the next round in a game, hosted by a game participant.",
    tags: ["Round"],
    request: createRoundRequestSchema,
    response: createRoundResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<CreateRoundResponse>) => {
      if (!isCreateRoundRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { gameId } = req.params;
      const { topic, hostedBy, endsAt } = req.body;

      try {
        const result = await config.db.transaction(async (tx) => {
          const [gameRow] = await tx
            .select({ participants: game.participants, rounds: game.rounds })
            .from(game)
            .where(eq(game.id, gameId))
            .limit(1);
          if (!gameRow) {
            return { error: "GAME_NOT_FOUND" as const };
          }
          if (!gameRow.participants.includes(hostedBy)) {
            return { error: "HOST_NOT_IN_GAME" as const };
          }

          const [created] = await tx
            .insert(round)
            .values({
              id: randomUUID(),
              game: gameId,
              roundNumber: gameRow.rounds.length + 1,
              hostedBy,
              topic,
              endsAt: endsAt === undefined ? null : new Date(endsAt),
            })
            .returning();
          if (!created) {
            return { error: "INSERT_FAILED" as const };
          }

          await tx
            .update(game)
            .set({ rounds: [...gameRow.rounds, created.id], updatedAt: new Date() })
            .where(eq(game.id, gameId));

          return { created };
        });

        if ("error" in result && result.error !== undefined) {
          if (result.error === "GAME_NOT_FOUND") {
            return res
              .status(404)
              .json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
          }
          if (result.error === "HOST_NOT_IN_GAME") {
            return res.status(400).json({
              ok: false,
              code: "INVALID_PLAYER",
              message: "The round host must participate in the game",
            });
          }
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to create round",
          });
        }
        if (!result.created) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to create round",
          });
        }

        config.log.info({ id: result.created.id, gameId, hostedBy }, "Created round");
        return res.status(201).json({ ok: true, round: serializeRound(result.created) });
      } catch (error) {
        config.log.error({ error: String(error), gameId }, "Create round error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to create round",
        });
      }
    },
  });
