import {
  isRecordGameScoreRequest,
  type RecordGameScoreResponse,
  recordGameScoreRequestSchema,
  recordGameScoreResponseSchema,
} from "@tier-list-league/api-schema";
import { and, eq, inArray } from "drizzle-orm";
import game from "../../../../database/schema/game";
import guess from "../../../../database/schema/guess";
import round from "../../../../database/schema/round";
import scoreEntry from "../../../../database/schema/score-entry";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../../route-helper";
import { aggregateGameScores, aggregateRoundScoreDeltas, buildRoundScoreEntries } from "./service";

export const recordGameScore = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Record round scores",
    description: "Finalize a round and calculate player score changes on the backend.",
    tags: ["Game", "Score"],
    request: recordGameScoreRequestSchema,
    response: recordGameScoreResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<RecordGameScoreResponse>) => {
      if (!isRecordGameScoreRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { gameId } = req.params;
      const input = req.body.round;
      const awardedGuessIds = [
        input.winningGuess,
        ...input.honorableMentions.map(({ guessId }) => guessId),
      ];

      if (new Set(awardedGuessIds).size !== awardedGuessIds.length) {
        return res.status(400).json({
          ok: false,
          code: "DUPLICATE_AWARD",
          message: "A guess can only receive one award per round",
        });
      }

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

          const [roundRow] = await tx
            .select({ id: round.id, game: round.game, hostedBy: round.hostedBy })
            .from(round)
            .where(eq(round.id, input.id))
            .limit(1);
          if (!roundRow || roundRow.game !== gameId) {
            return { error: "ROUND_NOT_FOUND" as const };
          }
          if (roundRow.hostedBy !== input.hostedBy) {
            return { error: "HOST_MISMATCH" as const };
          }

          const guesses = await tx
            .select({ id: guess.id, userId: guess.createdBy })
            .from(guess)
            .where(and(eq(guess.round, input.id), inArray(guess.id, awardedGuessIds)));
          if (guesses.length !== awardedGuessIds.length || guesses.some(({ userId }) => !userId)) {
            return { error: "GUESS_NOT_FOUND" as const };
          }

          const guessesById = new Map(
            guesses.flatMap((row) =>
              row.userId ? [[row.id, { id: row.id, userId: row.userId }]] : [],
            ),
          );
          const winner = guessesById.get(input.winningGuess);
          if (!winner) {
            return { error: "GUESS_NOT_FOUND" as const };
          }

          const honorableMentions = input.honorableMentions.flatMap((mention) => {
            const found = guessesById.get(mention.guessId);
            return found ? [{ ...found, title: mention.title }] : [];
          });
          if (honorableMentions.length !== input.honorableMentions.length) {
            return { error: "GUESS_NOT_FOUND" as const };
          }

          const awardedUserIds = [winner.userId, ...honorableMentions.map(({ userId }) => userId)];
          if (awardedUserIds.some((userId) => !gameRow.participants.includes(userId))) {
            return { error: "PLAYER_NOT_IN_GAME" as const };
          }

          const newEntries = buildRoundScoreEntries(gameId, input.id, winner, honorableMentions);
          const scoreDeltas = aggregateRoundScoreDeltas(
            newEntries.map((entry) => ({
              roundId: entry.round,
              userId: entry.user,
              score: entry.score,
              reason: entry.reason,
            })),
          );
          const now = new Date();

          await tx.delete(scoreEntry).where(eq(scoreEntry.round, input.id));
          await tx.insert(scoreEntry).values(newEntries);
          await tx
            .update(round)
            .set({
              winningGuess: input.winningGuess,
              honorableMentions: input.honorableMentions.map(({ guessId }) => guessId),
              honorableMentionDetails: input.honorableMentions,
              scoreDeltas,
              updatedAt: now,
              endsAt: now,
            })
            .where(eq(round.id, input.id));

          const allEntries = await tx
            .select({
              roundId: scoreEntry.round,
              userId: scoreEntry.user,
              score: scoreEntry.score,
              reason: scoreEntry.reason,
            })
            .from(scoreEntry)
            .where(eq(scoreEntry.game, gameId))
            .orderBy(scoreEntry.createdAt, scoreEntry.id);

          return {
            round: {
              id: input.id,
              winningGuess: input.winningGuess,
              honorableMentions: input.honorableMentions,
              scoreDeltas,
            },
            scores: aggregateGameScores(gameRow.participants, allEntries),
          };
        });

        if ("error" in result && result.error !== undefined) {
          return scoreErrorResponse(res, result.error);
        }

        return res.status(200).json({ ok: true, ...result });
      } catch (error) {
        config.log.error({ error: String(error), gameId, roundId: input.id }, "Record score error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to record round scores",
        });
      }
    },
  });

function scoreErrorResponse(
  res: ApiResponse<RecordGameScoreResponse>,
  error:
    | "GAME_NOT_FOUND"
    | "ROUND_NOT_FOUND"
    | "HOST_MISMATCH"
    | "GUESS_NOT_FOUND"
    | "PLAYER_NOT_IN_GAME",
) {
  switch (error) {
    case "GAME_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Game not found" });
    case "ROUND_NOT_FOUND":
      return res
        .status(404)
        .json({ ok: false, code: "NOT_FOUND", message: "Round not found in game" });
    case "HOST_MISMATCH":
      return res
        .status(403)
        .json({ ok: false, code: "FORBIDDEN", message: "Only the round host can record scores" });
    case "GUESS_NOT_FOUND":
      return res.status(400).json({
        ok: false,
        code: "INVALID_GUESS",
        message: "Awarded guesses must belong to the round",
      });
    case "PLAYER_NOT_IN_GAME":
      return res.status(400).json({
        ok: false,
        code: "INVALID_PLAYER",
        message: "Awarded players must participate in the game",
      });
  }
}
