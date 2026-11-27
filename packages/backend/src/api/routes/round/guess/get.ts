import {
  type GetRoundGuessesResponse,
  getRoundGuessesRequestSchema,
  getRoundGuessesResponseSchema,
  isGetRoundGuessesRequest,
} from "@tier-list-league/api-schema";
import { and, eq } from "drizzle-orm";
import guess from "../../../../database/schema/guess";
import { forbiddenResponse } from "../../../auth/game-access";
import { requireAuth } from "../../../auth/require-auth";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../../route-helper";
import { getRoundContext } from "../round-context";

export const getRoundGuesses = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Read visible round guesses",
    description:
      "Participants read their own guesses. The host sees all guesses during judging; all participants see them after finalization.",
    tags: ["Round", "Guess"],
    request: getRoundGuessesRequestSchema,
    response: getRoundGuessesResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetRoundGuessesResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (!isGetRoundGuessesRequest(req)) return requestSchemaFailure(res);
      res.setHeader("cache-control", "private, no-store");
      const { roundId } = req.params;
      try {
        const result = await config.db.transaction(async (tx) => {
          const context = await getRoundContext(tx, roundId, auth.sub);
          if (context.error !== undefined) return { error: context.error };
          const { roundRow } = context;
          const revealAll =
            roundRow.phase === "finalized" ||
            (roundRow.phase === "judging" && roundRow.hostedBy === auth.sub);
          const guesses = await tx
            .select()
            .from(guess)
            .where(
              and(eq(guess.round, roundId), revealAll ? undefined : eq(guess.createdBy, auth.sub)),
            )
            .orderBy(guess.createdAt, guess.id);
          return { guesses };
        });
        if (result.error !== undefined) {
          if (result.error === "ROUND_NOT_FOUND") {
            return res
              .status(404)
              .json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
          }
          return forbiddenResponse(res);
        }
        return res.status(200).json({
          ok: true,
          guesses: result.guesses.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          })),
        });
      } catch (error) {
        config.log.error({ roundId, error: String(error) }, "Read round guesses failed");
        return res
          .status(500)
          .json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to read round guesses" });
      }
    },
  });
