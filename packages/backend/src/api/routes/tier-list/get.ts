import {
  type GetTierListResponse,
  getTierListRequestSchema,
  getTierListResponseSchema,
  isGetTierListRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import tierList from "../../../database/schema/tier-list";
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
