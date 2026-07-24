import { eq } from "drizzle-orm";
import { z } from "zod";
import tierList from "../../../database/schema/tier-list";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

export const getTierList = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get tier list",
    description: "Get a single tier list by id.",
    tags: ["TierList"],
    response: z.unknown(),
    handler: async (req: TypedRequest, res) => {
      const id = req.params?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Missing id" });
      }
      const [found] = await config.db.select().from(tierList).where(eq(tierList.id, id)).limit(1);
      if (!found) {
        return res.status(404).json({ ok: false, error: "Tier list not found" });
      }
      return res.status(200).json({ ok: true, tierList: found });
    },
  });
