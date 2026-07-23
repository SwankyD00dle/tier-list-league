import { eq } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../../../database/client";
import round from "../../../database/schema/round";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

interface GetRoundConfig extends BaseHandlerConfig {
  db: typeof db;
}

export const getRound = (config: GetRoundConfig) =>
  defineRoute(config.log, {
    summary: "Get round",
    description: "Get a single round by id.",
    tags: ["Round"],
    response: z.unknown(),
    handler: async (req: TypedRequest, res) => {
      const id = req.params?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Missing id" });
      }
      const [found] = await config.db.select().from(round).where(eq(round.id, id)).limit(1);
      if (!found) {
        return res.status(404).json({ ok: false, error: "Round not found" });
      }
      return res.status(200).json({ ok: true, round: found });
    },
  });
