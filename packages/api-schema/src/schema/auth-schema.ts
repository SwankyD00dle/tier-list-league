import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiErrorResponseSchema, apiRequestSchema, apiSuccessResponseSchema } from "./api-schema";

export const authRedirectResponseSchema = z.union([
  apiSuccessResponseSchema,
  apiErrorResponseSchema,
]);

export type AuthRedirectResponse = ZodInfer<typeof authRedirectResponseSchema>;

export const startDiscordAuthRequestSchema = apiRequestSchema;

export type StartDiscordAuthRequest = ZodInfer<typeof startDiscordAuthRequestSchema>;

export const discordCallbackRequestSchema = z.extend(apiRequestSchema, {
  query: z.object({
    code: z.optional(z.string()),
    state: z.optional(z.string()),
    error: z.optional(z.string()),
  }),
});

export type DiscordCallbackRequest = ZodInfer<typeof discordCallbackRequestSchema>;

export const refreshAuthRequestSchema = apiRequestSchema;

export type RefreshAuthRequest = ZodInfer<typeof refreshAuthRequestSchema>;

export const refreshAuthResponseSchema = z.extend(apiSuccessResponseSchema, {
  ok: z.literal(true),
});

export type RefreshAuthResponse = ZodInfer<typeof refreshAuthResponseSchema>;

export const logoutRequestSchema = apiRequestSchema;

export type LogoutRequest = ZodInfer<typeof logoutRequestSchema>;

export const logoutResponseSchema = z.extend(apiSuccessResponseSchema, {
  ok: z.literal(true),
});

export type LogoutResponse = ZodInfer<typeof logoutResponseSchema>;

export const meRequestSchema = apiRequestSchema;

export type MeRequest = ZodInfer<typeof meRequestSchema>;

export const meResponseSchema = z.extend(apiSuccessResponseSchema, {
  id: z.uuid(),
  name: z.string(),
  discordUserId: z.string(),
});

export type MeResponse = ZodInfer<typeof meResponseSchema>;
