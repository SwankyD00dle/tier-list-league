import { sql } from "drizzle-orm";
import type { db } from "../../../database/client";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  REQUEST_SCHEMA_FAILURE_CODE,
  REQUEST_SCHEMA_FAILURE_MESSAGE,
} from "../../route-helper";
import { type HealthResponse, healthRequestSchema, healthResponseSchema } from "./schema";

export const healthCheck = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Health check",
    description: "Liveness and database connectivity probe.",
    tags: ["System"],
    request: healthRequestSchema,
    response: healthResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<HealthResponse>) => {
      const parsed = healthRequestSchema.safeParse(req);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: REQUEST_SCHEMA_FAILURE_CODE,
          message: parsed.error.issues[0]?.message ?? REQUEST_SCHEMA_FAILURE_MESSAGE,
        });
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
