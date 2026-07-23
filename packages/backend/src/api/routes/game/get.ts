import { eq } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

interface GetGameConfig extends BaseHandlerConfig {
  db: typeof db;
}

export const getGame = (config: GetGameConfig) =>
  defineRoute(config.log, {
    summary: "Get game",
    description: "Get a single game by id.",
    tags: ["Game"],
    response: z.unknown(),
    handler: async (req: TypedRequest, res) => {
      const id = req.params?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Missing id" });
      }
      const [found] = await config.db.select().from(game).where(eq(game.id, id)).limit(1);
      if (!found) {
        return res.status(404).json({ ok: false, error: "Game not found" });
      }
      return res.status(200).json({ ok: true, game: found });
    },
  });
