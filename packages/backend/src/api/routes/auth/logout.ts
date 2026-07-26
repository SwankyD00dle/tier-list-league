import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from "../../auth/cookies";
import { revokeRefreshToken } from "../../auth/tokens";
import { parseCookies } from "../../cookie";
import type { BaseHandlerConfig } from "../../handler";
import { type ApiRequest, type ApiResponse, defineRoute } from "../../route-helper";
import { type LogoutResponse, logoutRequestSchema, logoutResponseSchema } from "./schema";

export const logout = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Log out",
    description: "Revoke refresh token and clear auth cookies.",
    tags: ["Auth"],
    request: logoutRequestSchema,
    response: logoutResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<LogoutResponse>) => {
      const { log } = config;

      const parsedRequest = logoutRequestSchema.safeParse(req);
      if (!parsedRequest.success) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_REQUEST",
          message: "Invalid request",
        });
      }

      try {
        const cookies = parseCookies(parsedRequest.data.headers?.cookie);
        const presented = cookies[REFRESH_TOKEN_COOKIE];
        if (presented) {
          await revokeRefreshToken(config.db, presented);
        }

        res.clearCookie(ACCESS_TOKEN_COOKIE, clearAuthCookieOptions());
        res.clearCookie(REFRESH_TOKEN_COOKIE, clearAuthCookieOptions());
        return res.status(200).json({ ok: true });
      } catch (error) {
        log.error({ error: String(error) }, "Logout error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to log out",
        });
      }
    },
  });
