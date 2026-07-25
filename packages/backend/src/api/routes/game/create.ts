import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import game from "../../../database/schema/game";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../route-helper";
import {
  type CreateGameResponse,
  createGameRequestSchema,
  createGameResponseSchema,
} from "./schema";

export const createGame = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Create game",
    description: "Create a game and enroll its initial participants.",
    tags: ["Game"],
    request: createGameRequestSchema,
    response: createGameResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<CreateGameResponse>) => {
      const parsed = createGameRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const { name, description, roundCount, createdBy } = parsed.data.body;
      const participants = [...new Set([createdBy, ...parsed.data.body.participants])];

      try {
        const result = await config.db.transaction(async (tx) => {
          const users = await tx
            .select({ id: user.id })
            .from(user)
            .where(inArray(user.id, participants));
          if (users.length !== participants.length) {
            return { error: "USER_NOT_FOUND" as const };
          }

          const [created] = await tx
            .insert(game)
            .values({
              id: randomUUID(),
              name,
              description,
              roundCount,
              createdBy,
              participants,
            })
            .returning();
          if (!created) {
            return { error: "INSERT_FAILED" as const };
          }

          await tx
            .update(user)
            .set({ activeGames: sql`array_append(${user.activeGames}, ${created.id})` })
            .where(inArray(user.id, participants));

          return { created };
        });

        if ("error" in result && result.error !== undefined) {
          if (result.error === "USER_NOT_FOUND") {
            return res.status(400).json({
              ok: false,
              code: "INVALID_PLAYER",
              message: "Every participant must be an existing user",
            });
          }
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to create game",
          });
        }

        const { created } = result;
        if (!created) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to create game",
          });
        }

        config.log.info({ id: created.id, createdBy }, "Created game");
        return res.status(201).json({
          ok: true,
          game: {
            id: created.id,
            name: created.name,
            description: created.description,
            participants: created.participants,
            roundCount: created.roundCount,
            rounds: created.rounds,
            createdBy: created.createdBy,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        config.log.error({ error: String(error) }, "Create game error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to create game",
        });
      }
    },
  });
