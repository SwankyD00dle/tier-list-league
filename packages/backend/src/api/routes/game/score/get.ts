import {
  type GetGameScoresResponse,
  type GetUserGameScoreResponse,
  getGameScoresRequestSchema,
  getGameScoresResponseSchema,
  getUserGameScoreRequestSchema,
  getUserGameScoreResponseSchema,
  isGetGameScoresRequest,
  isGetUserGameScoreRequest,
} from "@tier-list-league/api-schema";
import { and, eq } from "drizzle-orm";
import type { db } from "../../../../database/client";
import game from "../../../../database/schema/game";
import scoreEntry from "../../../../database/schema/score-entry";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../../route-helper";
import { aggregateGameScores } from "./service";

export const getGameScores = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get game scores",
    description: "Get current scores and round-by-round scoring entries for every player.",
    tags: ["Game", "Score"],
    request: getGameScoresRequestSchema,
    response: getGameScoresResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetGameScoresResponse>) => {
      if (!isGetGameScoresRequest(req)) {
        return requestSchemaFailure(res);
      }

      const gameId = req.params.gameId;
      const gameRow = await findGame(config.db, gameId);
      if (!gameRow) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      const entries = await findScoreEntries(config.db, gameId);
      return res.status(200).json({
        ok: true,
        scores: aggregateGameScores(gameRow.participants, entries),
      });
    },
  });

export const getUserGameScore = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get a player's game score",
    description: "Get one player's current total and round-by-round scoring entries.",
    tags: ["Game", "Score"],
    request: getUserGameScoreRequestSchema,
    response: getUserGameScoreResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetUserGameScoreResponse>) => {
      if (!isGetUserGameScoreRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { gameId, userId } = req.params;
      const gameRow = await findGame(config.db, gameId);
      if (!gameRow) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }
      if (!gameRow.participants.includes(userId)) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Player not found in game",
        });
      }

      const entries = await findScoreEntries(config.db, gameId, userId);
      const score = aggregateGameScores([userId], entries)[userId];
      if (!score) {
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to aggregate player score",
        });
      }

      return res.status(200).json({ ok: true, userId, score });
    },
  });

async function findGame(database: typeof db, gameId: string) {
  const [found] = await database
    .select({ participants: game.participants })
    .from(game)
    .where(eq(game.id, gameId))
    .limit(1);
  return found;
}

function findScoreEntries(database: typeof db, gameId: string, userId?: string) {
  return database
    .select({
      roundId: scoreEntry.round,
      userId: scoreEntry.user,
      score: scoreEntry.score,
      reason: scoreEntry.reason,
    })
    .from(scoreEntry)
    .where(
      userId === undefined
        ? eq(scoreEntry.game, gameId)
        : and(eq(scoreEntry.game, gameId), eq(scoreEntry.user, userId)),
    )
    .orderBy(scoreEntry.createdAt, scoreEntry.id);
}
