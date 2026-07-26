import {
  isLogoutRequest,
  type LogoutResponse,
  logoutRequestSchema,
  logoutResponseSchema,
} from "@tier-list-league/api-schema";
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from "../../auth/cookies";
import { revokeRefreshToken } from "../../auth/tokens";
import { parseCookies } from "../../cookie";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const logout = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Log out",
    description: "Revoke refresh token and clear auth cookies.",
    tags: ["Auth"],
    request: logoutRequestSchema,
    response: logoutResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<LogoutResponse>) => {
      const { log } = config;

      if (!isLogoutRequest(req)) {
        return requestSchemaFailure(res);
      }

      try {
        const cookies = parseCookies(req.headers?.cookie);
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
