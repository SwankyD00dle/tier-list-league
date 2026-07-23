import { z } from "zod";
import type { db } from "../../../database/client";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

interface ListUsersConfig extends BaseHandlerConfig {
  db: typeof db;
}

export const listUsers = (config: ListUsersConfig) =>
  defineRoute(config.log, {
    summary: "List users",
    description: "List all users.",
    tags: ["User"],
    response: z.unknown(),
    handler: async (_req: TypedRequest, res) => {
      const users = await config.db.select().from(user);
      return res.status(200).json({ ok: true, users });
    },
  });
