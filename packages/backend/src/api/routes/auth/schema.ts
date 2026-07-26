import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import {
  apiErrorResponseSchema,
  apiRequestSchema,
  apiSuccessResponseSchema,
} from "../../route-helper";

export const authRedirectResponseSchema = z.union([
  apiSuccessResponseSchema,
  apiErrorResponseSchema,
]);

export type AuthRedirectResponse = ZodInfer<typeof authRedirectResponseSchema>;

export const startDiscordAuthRequestSchema = apiRequestSchema;

export const discordCallbackRequestSchema = z.extend(apiRequestSchema, {
  query: z.object({
    code: z.optional(z.string()),
    state: z.optional(z.string()),
    error: z.optional(z.string()),
  }),
});

export type DiscordCallbackRequest = ZodInfer<typeof discordCallbackRequestSchema>;

export const refreshAuthRequestSchema = apiRequestSchema;

export const refreshAuthResponseSchema = z.extend(apiSuccessResponseSchema, {
  ok: z.literal(true),
});

export type RefreshAuthResponse = ZodInfer<typeof refreshAuthResponseSchema>;

export const logoutRequestSchema = apiRequestSchema;

export const logoutResponseSchema = z.extend(apiSuccessResponseSchema, {
  ok: z.literal(true),
});

export type LogoutResponse = ZodInfer<typeof logoutResponseSchema>;

export const meRequestSchema = apiRequestSchema;

export const meResponseSchema = z.extend(apiSuccessResponseSchema, {
  id: z.uuid(),
  name: z.string(),
  discordUserId: z.string(),
});

export type MeResponse = ZodInfer<typeof meResponseSchema>;
