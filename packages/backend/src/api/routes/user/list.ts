import {
  isListUsersRequest,
  type ListUsersResponse,
  listUsersRequestSchema,
  listUsersResponseSchema,
} from "@tier-list-league/api-schema";
import type { db } from "../../../database/client";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const listUsers = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "List users",
    description: "List all users.",
    tags: ["User"],
    request: listUsersRequestSchema,
    response: listUsersResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<ListUsersResponse>) => {
      if (!isListUsersRequest(req)) {
        return requestSchemaFailure(res);
      }

      const users = await listUsersFromDb(config.db);
      return res.status(200).json({
        ok: true,
        users: users.map((row) => ({
          id: row.id,
          name: row.name,
          discordUserId: row.discordUserId,
          activeGames: row.activeGames,
          createdAt: row.createdAt.toISOString(),
        })),
      });
    },
  });

function listUsersFromDb(database: typeof db) {
  return database
    .select({
      id: user.id,
      name: user.name,
      discordUserId: user.discordUserId,
      activeGames: user.activeGames,
      createdAt: user.createdAt,
    })
    .from(user);
}
