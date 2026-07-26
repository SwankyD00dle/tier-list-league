import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "./api-schema";

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  discordUserId: z.string(),
  activeGames: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
});

export const getUserRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
});

export type GetUserRequest = ZodInfer<typeof getUserRequestSchema>;

export const getUserResponseSchema = z.extend(apiSuccessResponseSchema, {
  user: userSchema,
});

export type GetUserResponse = ZodInfer<typeof getUserResponseSchema>;

export const listUsersRequestSchema = apiRequestSchema;

export type ListUsersRequest = ZodInfer<typeof listUsersRequestSchema>;

export const listUsersResponseSchema = z.extend(apiSuccessResponseSchema, {
  users: z.array(userSchema),
});

export type ListUsersResponse = ZodInfer<typeof listUsersResponseSchema>;

export const createUserBodySchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(100)),
  discordUserId: z.string().check(z.minLength(1), z.maxLength(100)),
  games: z.array(z.string()),
});

export const createUserRequestSchema = z.extend(apiRequestSchema, {
  body: createUserBodySchema,
});

export type CreateUserRequest = ZodInfer<typeof createUserRequestSchema>;

export const createUserResponseSchema = z.extend(apiSuccessResponseSchema, {
  id: z.uuid(),
  name: z.string(),
  discordUserId: z.string(),
  createdAt: z.iso.datetime(),
});

export type CreateUserResponse = ZodInfer<typeof createUserResponseSchema>;
