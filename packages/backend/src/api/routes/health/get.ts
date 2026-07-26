import {
  type HealthResponse,
  healthRequestSchema,
  healthResponseSchema,
  isHealthRequest,
} from "@tier-list-league/api-schema";
import { sql } from "drizzle-orm";
import type { db } from "../../../database/client";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const healthCheck = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Health check",
    description: "Liveness and database connectivity probe.",
    tags: ["System"],
    request: healthRequestSchema,
    response: healthResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<HealthResponse>) => {
      if (!isHealthRequest(req)) {
        return requestSchemaFailure(res);
      }

      try {
        await pingDb(config.db);
        return res.status(200).json({ status: "ok" });
      } catch {
        return res.status(503).json({ status: "db_unavailable" });
      }
    },
  });

function pingDb(database: typeof db) {
  return database.execute(sql`select 1`);
}
