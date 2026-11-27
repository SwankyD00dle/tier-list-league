import {
  type GetRoundResponse,
  getRoundRequestSchema,
  getRoundResponseSchema,
  isGetRoundRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import round from "../../../database/schema/round";
import { forbiddenResponse, hasGameRole } from "../../auth/game-access";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { processRoundDeadline } from "./deadlines";
import { serializeRound } from "./serialize";

export const getRound = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get round",
    description: "Get a single round by id.",
    tags: ["Round"],
    request: getRoundRequestSchema,
    response: getRoundResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetRoundResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isGetRoundRequest(req)) {
        return requestSchemaFailure(res);
      }

      const [found] = await getRoundFromDb(config.db, req.params.id);
      if (!found) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Round not found",
        });
      }

      if (!(await hasGameRole(config.db, found.game, auth.sub, "participant"))) {
        return forbiddenResponse(res);
      }

      const current =
        found.phase === "guessing" && found.endsAt && found.endsAt <= new Date()
          ? await processRoundDeadline(config.db, found.id)
          : found;
      return res.status(200).json({ ok: true, round: serializeRound(current ?? found) });
    },
  });

function getRoundFromDb(database: typeof db, id: string) {
  return database
    .select({
      id: round.id,
      game: round.game,
      roundNumber: round.roundNumber,
      hostedBy: round.hostedBy,
      phase: round.phase,
      pendingGuessers: round.pendingGuessers,
      topic: round.topic,
      tierList: round.tierList,
      guesses: round.guesses,
      winningGuess: round.winningGuess,
      honorableMentions: round.honorableMentions,
      honorableMentionDetails: round.honorableMentionDetails,
      scoreDeltas: round.scoreDeltas,
      participantTierLists: round.participantTierLists,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
      endsAt: round.endsAt,
      guessingDurationMs: round.guessingDurationMs,
    })
    .from(round)
    .where(eq(round.id, id))
    .limit(1);
}
