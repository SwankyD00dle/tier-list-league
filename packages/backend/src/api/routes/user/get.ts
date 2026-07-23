import { eq } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../../../database/client";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

interface GetUserConfig extends BaseHandlerConfig {
  db: typeof db;
}

export const getUser = (config: GetUserConfig) =>
  defineRoute(config.log, {
    summary: "Get user",
    description: "Get a single user by id.",
    tags: ["User"],
    response: z.unknown(),
    handler: async (req: TypedRequest, res) => {
      const id = req.params?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Missing id" });
      }
      const [found] = await config.db.select().from(user).where(eq(user.id, id)).limit(1);
      if (!found) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      return res.status(200).json({ ok: true, user: found });
    },
  });
