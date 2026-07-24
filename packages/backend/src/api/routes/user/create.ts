import { randomUUID } from "node:crypto";
import { z } from "zod";
import user from "../../../database/schema/user";
import type { BaseHandlerConfig } from "../../handler";
import { apiErrorResponseSchema, defineRoute, type TypedRequest } from "../../route-helper";

const createUserBodySchema = z.object({
  name: z.string().min(1).max(100).describe("Display name for the user"),
  discordUserId: z.string().min(1).max(100).describe("Discord snowflake ID for the user"),
  games: z.array(z.string()).describe("Game IDs the user is participating in"),
});

export type CreateUserRequest = z.infer<typeof createUserBodySchema>;

const createUserSuccessSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
  name: z.string(),
  discordUserId: z.string(),
  createdAt: z.string(),
});

const createUserResponseSchema = z.discriminatedUnion("ok", [
  createUserSuccessSchema,
  apiErrorResponseSchema,
]);

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;

export const createUser = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    body: { schema: createUserBodySchema, skipValidation: true },
    summary: "Create user",
    description: "Create a new user.",
    tags: ["User"],
    response: createUserResponseSchema,
    successStatusCode: 201,
    handler: async (req: TypedRequest, res) => {
      const { log, db } = config;

      try {
        const validationResult = createUserBodySchema.safeParse(req.body);

        if (!validationResult.success) {
          return res.status(400).json({
            ok: false,
            error: validationResult.error.issues[0]?.message ?? "Invalid request body",
          });
        }

        const { name, discordUserId } = validationResult.data;
        const id = randomUUID();

        const [created] = await db
          .insert(user)
          .values({
            id,
            name,
            discordUserId,
          })
          .returning();

        if (!created) {
          return res.status(500).json({
            ok: false,
            error: "Failed to create user",
          });
        }

        log.info(
          {
            id: created.id,
            discordUserId: created.discordUserId,
          },
          "Created user",
        );

        const resp: CreateUserResponse = {
          ok: true,
          id: created.id,
          name: created.name,
          discordUserId: created.discordUserId,
          createdAt: created.createdAt.toISOString(),
        };

        return res.status(201).json(resp);
      } catch (error) {
        log.error({ error: String(error) }, "Create user error");
        return res.status(500).json({
          ok: false,
          error: "Failed to create user",
        });
      }
    },
  });
