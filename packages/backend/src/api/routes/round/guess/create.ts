import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import game from "../../../../database/schema/game";
import guess from "../../../../database/schema/guess";
import round from "../../../../database/schema/round";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../../route-helper";
import {
  type SubmitGuessResponse,
  submitGuessRequestSchema,
  submitGuessResponseSchema,
} from "./schema";

export const submitGuess = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Submit guess",
    description:
      "Submit a participant's guess for an unfinalized round. Resubmitting replaces the participant's previous guess.",
    tags: ["Round", "Guess"],
    request: submitGuessRequestSchema,
    response: submitGuessResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<SubmitGuessResponse>) => {
      const parsed = submitGuessRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const { roundId } = parsed.data.params;
      const { userId, data } = parsed.data.body;

      try {
        const result = await config.db.transaction(async (tx) => {
          const [roundRow] = await tx
            .select({
              game: round.game,
              guesses: round.guesses,
              winningGuess: round.winningGuess,
            })
            .from(round)
            .where(eq(round.id, roundId))
            .limit(1);
          if (!roundRow) {
            return { error: "ROUND_NOT_FOUND" as const };
          }
          if (roundRow.winningGuess !== null) {
            return { error: "ROUND_FINALIZED" as const };
          }
          if (roundRow.game === null) {
            return { error: "PLAYER_NOT_IN_GAME" as const };
          }

          const [gameRow] = await tx
            .select({ participants: game.participants })
            .from(game)
            .where(eq(game.id, roundRow.game))
            .limit(1);
          if (!gameRow?.participants.includes(userId)) {
            return { error: "PLAYER_NOT_IN_GAME" as const };
          }

          const [existing] = await tx
            .select({ id: guess.id })
            .from(guess)
            .where(and(eq(guess.round, roundId), eq(guess.createdBy, userId)))
            .limit(1);
          if (existing) {
            const [updated] = await tx
              .update(guess)
              .set({ data, updatedAt: new Date() })
              .where(eq(guess.id, existing.id))
              .returning();
            return { saved: updated, created: false };
          }

          const [inserted] = await tx
            .insert(guess)
            .values({ id: randomUUID(), round: roundId, data, createdBy: userId })
            .returning();
          if (!inserted) {
            return { error: "INSERT_FAILED" as const };
          }

          await tx
            .update(round)
            .set({ guesses: [...roundRow.guesses, inserted.id], updatedAt: new Date() })
            .where(eq(round.id, roundId));

          return { saved: inserted, created: true };
        });

        if ("error" in result && result.error !== undefined) {
          return guessErrorResponse(res, result.error);
        }
        if (!result.saved) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to submit guess",
          });
        }

        return res.status(result.created ? 201 : 200).json({
          ok: true,
          guess: {
            id: result.saved.id,
            round: result.saved.round,
            data: result.saved.data,
            createdBy: result.saved.createdBy,
            createdAt: result.saved.createdAt.toISOString(),
            updatedAt: result.saved.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        config.log.error({ error: String(error), roundId, userId }, "Submit guess error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to submit guess",
        });
      }
    },
  });

function guessErrorResponse(
  res: ApiResponse<SubmitGuessResponse>,
  error: "ROUND_NOT_FOUND" | "ROUND_FINALIZED" | "PLAYER_NOT_IN_GAME" | "INSERT_FAILED",
) {
  switch (error) {
    case "ROUND_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
    case "ROUND_FINALIZED":
      return res.status(409).json({
        ok: false,
        code: "ROUND_FINALIZED",
        message: "Guesses cannot change after a round is finalized",
      });
    case "PLAYER_NOT_IN_GAME":
      return res.status(400).json({
        ok: false,
        code: "INVALID_PLAYER",
        message: "Only game participants can submit guesses",
      });
    case "INSERT_FAILED":
      return res.status(500).json({
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Failed to submit guess",
      });
  }
}
