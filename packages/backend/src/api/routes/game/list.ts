import { z } from "zod";
import type { db } from "../../../database/client";
import game from "../../../database/schema/game";
import type { BaseHandlerConfig } from "../../handler";
import { defineRoute, type TypedRequest } from "../../route-helper";

interface ListGamesConfig extends BaseHandlerConfig {
  db: typeof db;
}

export const listGames = (config: ListGamesConfig) =>
  defineRoute(config.log, {
    summary: "List games",
    description: "List all games.",
    tags: ["Game"],
    response: z.unknown(),
    handler: async (_req: TypedRequest, res) => {
      const games = await config.db.select().from(game);
      return res.status(200).json({ ok: true, games });
    },
  });
