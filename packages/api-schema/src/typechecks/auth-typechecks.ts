import {
  type AuthRedirectResponse,
  authRedirectResponseSchema,
  type DiscordCallbackRequest,
  discordCallbackRequestSchema,
  type LogoutRequest,
  type LogoutResponse,
  logoutRequestSchema,
  logoutResponseSchema,
  type MeRequest,
  type MeResponse,
  meRequestSchema,
  meResponseSchema,
  type RefreshAuthRequest,
  type RefreshAuthResponse,
  refreshAuthRequestSchema,
  refreshAuthResponseSchema,
  type StartDiscordAuthRequest,
  startDiscordAuthRequestSchema,
} from "../schema/auth-schema";
import { matchesSchema } from "./typecheck";

export function isStartDiscordAuthRequest(data: unknown): data is StartDiscordAuthRequest {
  return matchesSchema(startDiscordAuthRequestSchema, data);
}

export function isDiscordCallbackRequest(data: unknown): data is DiscordCallbackRequest {
  return matchesSchema(discordCallbackRequestSchema, data);
}

export function isAuthRedirectResponse(data: unknown): data is AuthRedirectResponse {
  return matchesSchema(authRedirectResponseSchema, data);
}

export function isRefreshAuthRequest(data: unknown): data is RefreshAuthRequest {
  return matchesSchema(refreshAuthRequestSchema, data);
}

export function isRefreshAuthResponse(data: unknown): data is RefreshAuthResponse {
  return matchesSchema(refreshAuthResponseSchema, data);
}

export function isLogoutRequest(data: unknown): data is LogoutRequest {
  return matchesSchema(logoutRequestSchema, data);
}

export function isLogoutResponse(data: unknown): data is LogoutResponse {
  return matchesSchema(logoutResponseSchema, data);
}

export function isMeRequest(data: unknown): data is MeRequest {
  return matchesSchema(meRequestSchema, data);
}

export function isMeResponse(data: unknown): data is MeResponse {
  return matchesSchema(meResponseSchema, data);
}
