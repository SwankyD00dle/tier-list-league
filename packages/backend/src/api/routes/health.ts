import { sql } from "drizzle-orm";
import { z } from "zod";
import type { BaseHandlerConfig } from "../handler";
import { defineRoute, type TypedRequest } from "../route-helper";

export const healthCheck = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Health check",
    description: "Liveness and database connectivity probe.",
    tags: ["System"],
    response: z.unknown(),
    handler: async (_req: TypedRequest, res) => {
      try {
        await config.db.execute(sql`select 1`);
        return res.status(200).json({ status: "ok" });
      } catch {
        return res.status(503).json({ status: "db_unavailable" });
      }
    },
  });
