import { randomUUID } from "node:crypto";
import {
  type CreateUserResponse,
  createUserRequestSchema,
  createUserResponseSchema,
  isCreateUserRequest,
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

export const createUser = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Create user",
    description: "Create a new user.",
    tags: ["User"],
    request: createUserRequestSchema,
    response: createUserResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<CreateUserResponse>) => {
      const { log } = config;

      try {
        if (!isCreateUserRequest(req)) {
          return requestSchemaFailure(res);
        }

        const { name, discordUserId } = req.body;
        const [created] = await createUserInDb(config.db, {
          id: randomUUID(),
          name,
          discordUserId,
        });

        if (!created) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to create user",
          });
        }

        log.info(
          {
            id: created.id,
            discordUserId: created.discordUserId,
          },
          "Created user",
        );

        return res.status(201).json({
          ok: true,
          id: created.id,
          name: created.name,
          discordUserId: created.discordUserId,
          createdAt: created.createdAt.toISOString(),
        });
      } catch (error) {
        log.error({ error: String(error) }, "Create user error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to create user",
        });
      }
    },
  });

function createUserInDb(
  database: typeof db,
  values: { id: string; name: string; discordUserId: string },
) {
  return database.insert(user).values(values).returning({
    id: user.id,
    name: user.name,
    discordUserId: user.discordUserId,
    createdAt: user.createdAt,
  });
}
