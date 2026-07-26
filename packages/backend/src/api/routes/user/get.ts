import {
  type GetUserResponse,
  getUserRequestSchema,
  getUserResponseSchema,
  isGetUserRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const getUser = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Get user",
    description: "Get a single user by id.",
    tags: ["User"],
    request: getUserRequestSchema,
    response: getUserResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<GetUserResponse>) => {
      if (!isGetUserRequest(req)) {
        return requestSchemaFailure(res);
      }

      const [found] = await getUserFromDb(config.db, req.params.id);
      if (!found) {
        return res.status(404).json({
          ok: false,
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return res.status(200).json({
        ok: true,
        user: {
          id: found.id,
          name: found.name,
          discordUserId: found.discordUserId,
          activeGames: found.activeGames,
          createdAt: found.createdAt.toISOString(),
        },
      });
    },
  });

function getUserFromDb(database: typeof db, id: string) {
  return database
    .select({
      id: user.id,
      name: user.name,
      discordUserId: user.discordUserId,
      activeGames: user.activeGames,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
}
