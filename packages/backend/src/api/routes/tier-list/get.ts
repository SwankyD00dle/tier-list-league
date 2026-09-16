import {
  type GetTierListResponse,
  getTierListRequestSchema,
  getTierListResponseSchema,
  isGetTierListRequest,
} from "@tier-list-league/api-schema";
import { and, arrayContains, eq, or } from "drizzle-orm";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import round from "../../../database/schema/round";
import tierList from "../../../database/schema/tier-list";
import { forbiddenResponse } from "../../auth/game-access";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const getTierList = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get tier list",
    description: "Get a single tier list by id.",
    tags: ["TierList"],
    request: getTierListRequestSchema,
    response: getTierListResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetTierListResponse>) => {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      if (!isGetTierListRequest(req)) {
        return requestSchemaFailure(res);
      }

      const [found] = await getTierListFromDb(config.db, req.params.id);
      if (!found) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "Tier list not found",
        });
      }

      const [membership] = await config.db
        .select({ id: game.id })
        .from(round)
        .innerJoin(game, eq(round.game, game.id))
        .where(
          and(
            or(eq(round.tierList, found.id), arrayContains(round.participantTierLists, [found.id])),
            arrayContains(game.participants, [auth.sub]),
          ),
        )
        .limit(1);
      if (!membership) {
        return forbiddenResponse(res);
      }

      return res.status(200).json({
        ok: true,
        tierList: {
          id: found.id,
          createdBy: found.createdBy,
          data: found.data,
          createdAt: found.createdAt.toISOString(),
          updatedAt: found.updatedAt.toISOString(),
        },
      });
    },
  });

function getTierListFromDb(database: typeof db, id: string) {
  return database
    .select({
      id: tierList.id,
      createdBy: tierList.createdBy,
      data: tierList.data,
      createdAt: tierList.createdAt,
      updatedAt: tierList.updatedAt,
    })
    .from(tierList)
    .where(eq(tierList.id, id))
    .limit(1);
}
