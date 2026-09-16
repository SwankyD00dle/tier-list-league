import { randomUUID } from "node:crypto";
import {
  type AuthRedirectResponse,
  authRedirectResponseSchema,
  discordCallbackRequestSchema,
  isDiscordCallbackRequest,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import type { db } from "../../../database/client";
import user from "../../../database/schema/user";
import {
  ACCESS_TOKEN_COOKIE,
  authCookieOptions,
  clearAuthCookieOptions,
  OAUTH_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../auth/cookies";
import { discordDisplayName, exchangeDiscordCode, fetchDiscordUser } from "../../auth/discord";
import { createRefreshToken, signAccessToken } from "../../auth/tokens";
import { parseCookies } from "../../cookie";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";
import { getAuthConfig } from "./config";

export const discordCallback = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Discord OAuth callback",
    description: "Exchange Discord code, upsert user, set auth cookies, redirect home.",
    tags: ["Auth"],
    request: discordCallbackRequestSchema,
    response: authRedirectResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<AuthRedirectResponse>) => {
      const { log } = config;
      const { frontendUrl, accessTokenTtlSeconds, refreshTokenTtlSeconds } = getAuthConfig();

      try {
        if (!isDiscordCallbackRequest(req)) {
          return requestSchemaFailure(res);
        }

        const { code, state, error } = req.query;
        if (error !== undefined) {
          log.error({ error }, "Discord OAuth error");
          return res.redirect(`${frontendUrl.replace(/\/$/, "")}/?authError=discord`);
        }

        if (code === undefined || code === "" || state === undefined || state === "") {
          return res.status(400).json({
            ok: false,
            code: "INVALID_CALLBACK",
            message: "Missing code or state",
          });
        }

        const cookies = parseCookies(req.headers?.cookie);
        const storedState = cookies[OAUTH_STATE_COOKIE];
        if (storedState === undefined || storedState !== state) {
          return res.status(400).json({
            ok: false,
            code: "INVALID_STATE",
            message: "OAuth state mismatch",
          });
        }

        const discordAccessToken = await exchangeDiscordCode(code);
        const discordUser = await fetchDiscordUser(discordAccessToken);
        const name = discordDisplayName(discordUser);

        const upserted = await upsertUserByDiscordId(config.db, {
          discordUserId: discordUser.id,
          name,
        });

        if (!upserted) {
          return res.status(500).json({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Failed to upsert user",
          });
        }

        const accessToken = await signAccessToken({
          sub: upserted.id,
          discordUserId: upserted.discordUserId,
        });
        const refresh = await createRefreshToken(config.db, upserted.id);

        res.clearCookie(OAUTH_STATE_COOKIE, clearAuthCookieOptions());
        res.setCookie(ACCESS_TOKEN_COOKIE, accessToken, authCookieOptions(accessTokenTtlSeconds));
        res.setCookie(
          REFRESH_TOKEN_COOKIE,
          refresh.token,
          authCookieOptions(refreshTokenTtlSeconds),
        );

        log.info({ id: upserted.id, discordUserId: upserted.discordUserId }, "Discord login");
        return res.redirect(`${frontendUrl.replace(/\/$/, "")}/`);
      } catch (error) {
        log.error({ error: String(error) }, "Discord callback error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to complete Discord authentication",
        });
      }
    },
  });

async function upsertUserByDiscordId(
  database: typeof db,
  values: { discordUserId: string; name: string },
) {
  const [existing] = await database
    .select({
      id: user.id,
      name: user.name,
      discordUserId: user.discordUserId,
    })
    .from(user)
    .where(eq(user.discordUserId, values.discordUserId))
    .limit(1);

  if (existing) {
    const [updated] = await database
      .update(user)
      .set({ name: values.name })
      .where(eq(user.id, existing.id))
      .returning({
        id: user.id,
        name: user.name,
        discordUserId: user.discordUserId,
      });
    return updated;
  }

  const [created] = await database
    .insert(user)
    .values({
      id: randomUUID(),
      name: values.name,
      discordUserId: values.discordUserId,
    })
    .returning({
      id: user.id,
      name: user.name,
      discordUserId: user.discordUserId,
    });

  return created;
}
