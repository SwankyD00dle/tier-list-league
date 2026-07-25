import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import game from "../../../../database/schema/game";
import round from "../../../../database/schema/round";
import tierList from "../../../../database/schema/tier-list";
import type { BaseHandlerConfig } from "../../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../../route-helper";
import {
  type SubmitTierListResponse,
  submitTierListRequestSchema,
  submitTierListResponseSchema,
} from "./schema";

export const submitTierList = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Submit tier list",
    description:
      "Submit or update a tier list for an unfinalized round. The host's submission becomes the round's canonical tier list; participants' submissions join participantTierLists.",
    tags: ["Round", "TierList"],
    request: submitTierListRequestSchema,
    response: submitTierListResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<SubmitTierListResponse>) => {
      const parsed = submitTierListRequestSchema.safeParse(req);
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
              hostedBy: round.hostedBy,
              tierList: round.tierList,
              participantTierLists: round.participantTierLists,
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

          const isHost = roundRow.hostedBy === userId;
          const existingId = isHost
            ? roundRow.tierList
            : await findParticipantTierListId(tx, roundRow.participantTierLists, userId);

          if (existingId) {
            const [updated] = await tx
              .update(tierList)
              .set({ data, updatedAt: new Date() })
              .where(eq(tierList.id, existingId))
              .returning();
            return { saved: updated, created: false, isHost };
          }

          const [inserted] = await tx
            .insert(tierList)
            .values({ id: randomUUID(), createdBy: userId, data })
            .returning();
          if (!inserted) {
            return { error: "INSERT_FAILED" as const };
          }

          await tx
            .update(round)
            .set({
              ...(isHost
                ? { tierList: inserted.id }
                : {
                    participantTierLists: [...(roundRow.participantTierLists ?? []), inserted.id],
                  }),
              updatedAt: new Date(),
            })
            .where(eq(round.id, roundId));

          return { saved: inserted, created: true, isHost };
        });

        if ("error" in result && result.error !== undefined) {
          return tierListErrorResponse(res, result.error);
        }
        if (!result.saved) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to submit tier list",
          });
        }

        return res.status(result.created ? 201 : 200).json({
          ok: true,
          tierList: {
            id: result.saved.id,
            createdBy: result.saved.createdBy,
            data: result.saved.data,
            createdAt: result.saved.createdAt.toISOString(),
            updatedAt: result.saved.updatedAt.toISOString(),
          },
          role: result.isHost ? "host" : "participant",
        });
      } catch (error) {
        config.log.error({ error: String(error), roundId, userId }, "Submit tier list error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to submit tier list",
        });
      }
    },
  });

async function findParticipantTierListId(
  tx: Parameters<Parameters<BaseHandlerConfig["db"]["transaction"]>[0]>[0],
  participantTierLists: string[] | null,
  userId: string,
) {
  if (!participantTierLists || participantTierLists.length === 0) {
    return null;
  }
  const [existing] = await tx
    .select({ id: tierList.id })
    .from(tierList)
    .where(and(inArray(tierList.id, participantTierLists), eq(tierList.createdBy, userId)))
    .limit(1);
  return existing?.id ?? null;
}

function tierListErrorResponse(
  res: ApiResponse<SubmitTierListResponse>,
  error: "ROUND_NOT_FOUND" | "ROUND_FINALIZED" | "PLAYER_NOT_IN_GAME" | "INSERT_FAILED",
) {
  switch (error) {
    case "ROUND_NOT_FOUND":
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Round not found" });
    case "ROUND_FINALIZED":
      return res.status(409).json({
        ok: false,
        code: "ROUND_FINALIZED",
        message: "Tier lists cannot change after a round is finalized",
      });
    case "PLAYER_NOT_IN_GAME":
      return res.status(400).json({
        ok: false,
        code: "INVALID_PLAYER",
        message: "Only game participants can submit tier lists",
      });
    case "INSERT_FAILED":
      return res.status(500).json({
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Failed to submit tier list",
      });
  }
}
