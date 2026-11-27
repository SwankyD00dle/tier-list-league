import { randomUUID } from "node:crypto";
import {
  isSubmitGuessRequest,
  type SubmitGuessResponse,
  submitGuessRequestSchema,
  submitGuessResponseSchema,
} from "@tier-list-league/api-schema";
import { and, eq } from "drizzle-orm";
import guess from "../../../../database/schema/guess";
import round from "../../../../database/schema/round";
import roundEvent from "../../../../database/schema/round-event";
import { forbiddenResponse } from "../../../auth/game-access";
import { requireAuth } from "../../../auth/require-auth";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../../route-helper";

import { getSubmissionContext } from "../round-context";

export const submitGuess = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Submit guess",
    description:
      "Submit a participant's guess for an unfinalized round. Resubmitting replaces the participant's previous guess.",
    tags: ["Round", "Guess"],
    request: submitGuessRequestSchema,
    response: submitGuessResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<SubmitGuessResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isSubmitGuessRequest(req)) {
        return requestSchemaFailure(res);
      }

      const { roundId } = req.params;
      const { userId, data } = req.body;
      if (userId !== auth.sub) {
        return forbiddenResponse(res);
      }

      try {
        const result = await config.db.transaction(async (tx) => {
          const context = await getSubmissionContext(tx, roundId, userId);
          if (context.error !== undefined) {
            return { error: context.error };
          }
          const { roundRow } = context;

          if (roundRow.phase !== "guessing" || roundRow.hostedBy === userId) {
            return { error: "INVALID_PHASE" as const };
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
            if (!updated) {
              throw new Error("Submission write returned no row");
            }
            await tx.insert(roundEvent).values({
              round: roundId,
              actor: auth.sub,
              kind: "guess_submitted",
              payload: {
                kind: "guess_submitted",
                submissionId: updated.id,
                operation: "updated",
                data: updated.data,
              },
            });

            return { saved: updated, created: false };
          }

          if (!roundRow.pendingGuessers.includes(userId)) {
            return { error: "INVALID_PHASE" as const };
          }
          const pendingGuessers = roundRow.pendingGuessers.filter((id) => id !== userId);
          const [inserted] = await tx
            .insert(guess)
            .values({ id: randomUUID(), round: roundId, data, createdBy: userId })
            .returning();
          if (!inserted) {
            return { error: "INSERT_FAILED" as const };
          }

          await tx
            .update(round)
            .set({
              guesses: [...roundRow.guesses, inserted.id],
              pendingGuessers,
              phase: pendingGuessers.length === 0 ? "judging" : "guessing",
              updatedAt: new Date(),
            })
            .where(eq(round.id, roundId));

          if (!inserted) {
            throw new Error("Submission write returned no row");
          }
          await tx.insert(roundEvent).values({
            round: roundId,
            actor: auth.sub,
            kind: "guess_submitted",
            payload: {
              kind: "guess_submitted",
              submissionId: inserted.id,
              operation: "created",
              data: inserted.data,
            },
          });

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
  error:
    | "INVALID_PHASE"
    | "ROUND_NOT_FOUND"
    | "ROUND_FINALIZED"
    | "PLAYER_NOT_IN_GAME"
    | "INSERT_FAILED",
) {
  switch (error) {
    case "INVALID_PHASE":
      return res.status(409).json({
        ok: false,
        code: "INVALID_PHASE",
        message: "This action is unavailable in the current round phase",
      });
    case "ROUND_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
    case "ROUND_FINALIZED":
      return res.status(409).json({
        ok: false,
        code: "ROUND_FINALIZED",
        message: "Guesses cannot change after a round is finalized",
      });
    case "PLAYER_NOT_IN_GAME":
      return res.status(403).json({
        ok: false,
        code: "FORBIDDEN",
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
