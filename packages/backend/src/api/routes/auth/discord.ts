import { randomBytes } from "node:crypto";
import { authCookieOptions, OAUTH_STATE_COOKIE } from "../../auth/cookies";
import { buildDiscordAuthorizeUrl } from "../../auth/discord";
import type { BaseHandlerConfig } from "../../handler";
import { type ApiRequest, type ApiResponse, defineRoute } from "../../route-helper";
import {
  type AuthRedirectResponse,
  authRedirectResponseSchema,
  startDiscordAuthRequestSchema,
} from "./schema";

const OAUTH_STATE_TTL_SECONDS = 600;

export const startDiscordAuth = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Start Discord OAuth",
    description: "Redirect to Discord authorization.",
    tags: ["Auth"],
    request: startDiscordAuthRequestSchema,
    response: authRedirectResponseSchema,
    handler: async (_req: ApiRequest, res: ApiResponse<AuthRedirectResponse>) => {
      try {
        const state = randomBytes(24).toString("base64url");
        res.setCookie(OAUTH_STATE_COOKIE, state, authCookieOptions(OAUTH_STATE_TTL_SECONDS));
        return res.redirect(buildDiscordAuthorizeUrl(state));
      } catch (error) {
        config.log.error({ error: String(error) }, "Start Discord auth error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to start Discord authentication",
        });
      }
    },
  });
