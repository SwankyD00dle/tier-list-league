import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import round from "../../../database/schema/round";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../route-helper";
import { type GetRoundResponse, getRoundRequestSchema, getRoundResponseSchema } from "./schema";

export const getRound = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get round",
    description: "Get a single round by id.",
    tags: ["Round"],
    request: getRoundRequestSchema,
    response: getRoundResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetRoundResponse>) => {
      const parsed = getRoundRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
      }

      const [found] = await getRoundFromDb(config.db, parsed.data.params.id);
      if (!found) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Round not found",
        });
      }

      return res.status(200).json({
        ok: true,
        round: {
          id: found.id,
          game: found.game,
          roundNumber: found.roundNumber,
          hostedBy: found.hostedBy,
          topic: found.topic,
          tierList: found.tierList,
          guesses: found.guesses,
          winningGuess: found.winningGuess,
          honorableMentions: found.honorableMentions,
          honorableMentionDetails: found.honorableMentionDetails,
          scoreDeltas: found.scoreDeltas,
          participantTierLists: found.participantTierLists,
          createdAt: found.createdAt.toISOString(),
          updatedAt: found.updatedAt?.toISOString() ?? null,
          endsAt: found.endsAt?.toISOString() ?? null,
        },
      });
    },
  });

function getRoundFromDb(database: typeof db, id: string) {
  return database
    .select({
      id: round.id,
      game: round.game,
      roundNumber: round.roundNumber,
      hostedBy: round.hostedBy,
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
    })
    .from(round)
    .where(eq(round.id, id))
    .limit(1);
}
