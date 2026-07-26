import {
  type RefreshAuthResponse,
  refreshAuthRequestSchema,
  refreshAuthResponseSchema,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import user from "../../../database/schema/user";
import {
  ACCESS_TOKEN_COOKIE,
  authCookieOptions,
  clearAuthCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from "../../auth/cookies";
import { rotateRefreshToken, signAccessToken } from "../../auth/tokens";
import { parseCookies } from "../../cookie";
import type { BaseHandlerConfig } from "../../handler";
import { type ApiRequest, type ApiResponse, defineRoute } from "../../route-helper";
import { getAuthConfig } from "./config";

export const refreshAuth = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Refresh auth tokens",
    description: "Rotate refresh token and issue a new access token.",
    tags: ["Auth"],
    request: refreshAuthRequestSchema,
    response: refreshAuthResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<RefreshAuthResponse>) => {
      const { log } = config;
      const { accessTokenTtlSeconds, refreshTokenTtlSeconds } = getAuthConfig();

      try {
        const cookies = parseCookies(req.headers?.cookie);
        const presented = cookies[REFRESH_TOKEN_COOKIE];

        if (!presented) {
          return res.status(401).json({
            ok: false,
            code: "UNAUTHORIZED",
            message: "Refresh token required",
          });
        }

        const rotated = await rotateRefreshToken(config.db, presented);
        if (!rotated) {
          res.clearCookie(ACCESS_TOKEN_COOKIE, clearAuthCookieOptions());
          res.clearCookie(REFRESH_TOKEN_COOKIE, clearAuthCookieOptions());
          return res.status(401).json({
            ok: false,
            code: "UNAUTHORIZED",
            message: "Invalid or expired refresh token",
          });
        }

        const [found] = await config.db
          .select({
            id: user.id,
            discordUserId: user.discordUserId,
          })
          .from(user)
          .where(eq(user.id, rotated.userId))
          .limit(1);

        if (!found) {
          res.clearCookie(ACCESS_TOKEN_COOKIE, clearAuthCookieOptions());
          res.clearCookie(REFRESH_TOKEN_COOKIE, clearAuthCookieOptions());
          return res.status(401).json({
            ok: false,
            code: "UNAUTHORIZED",
            message: "User not found",
          });
        }

        const accessToken = await signAccessToken({
          sub: found.id,
          discordUserId: found.discordUserId,
        });

        res.setCookie(ACCESS_TOKEN_COOKIE, accessToken, authCookieOptions(accessTokenTtlSeconds));
        res.setCookie(
          REFRESH_TOKEN_COOKIE,
          rotated.token,
          authCookieOptions(refreshTokenTtlSeconds),
        );

        return res.status(200).json({ ok: true });
      } catch (error) {
        log.error({ error: String(error) }, "Refresh auth error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to refresh authentication",
        });
      }
    },
  });
