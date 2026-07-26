import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../../auth/cookies";
import { hashToken, signAccessToken } from "../../../auth/tokens";
import {
  createMockConfig,
  createMockDb,
  createMockLogger,
  createMockResponse,
} from "../../../test-helpers";
import { discordCallback } from "../callback";
import { resetAuthConfigCache } from "../config";
import { startDiscordAuth } from "../discord";
import { logout } from "../logout";
import { getMe } from "../me";
import { refreshAuth } from "../refresh";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const refreshRowId = "660e8400-e29b-41d4-a716-446655440000";

function setAuthEnv(): void {
  process.env.DISCORD_CLIENT_ID = "client-id";
  process.env.DISCORD_CLIENT_SECRET = "client-secret";
  process.env.DISCORD_REDIRECT_URI = "http://localhost:3000/api/auth/discord/callback";
  process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars!!";
  process.env.FRONTEND_URL = "http://localhost:3000";
  process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
  process.env.REFRESH_TOKEN_TTL_SECONDS = "2592000";
  process.env.COOKIE_SECURE = "false";
  resetAuthConfigCache();
}

describe("auth routes", () => {
  beforeEach(() => {
    setAuthEnv();
  });

  afterEach(() => {
    resetAuthConfigCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("redirects to Discord with an oauth_state cookie", async () => {
    const { res, state } = createMockResponse();
    const route = startDiscordAuth(createMockConfig());

    await route.handler({}, res);

    expect(state.statusCode).toBe(302);
    expect(state.redirectUrl).toContain("https://discord.com/api/oauth2/authorize");
    expect(state.redirectUrl).toContain("client_id=client-id");
    expect(
      state.cookies.some((cookie: string) => cookie.startsWith(`${OAUTH_STATE_COOKIE}=`)),
    ).toBe(true);
  });

  it("completes Discord callback, upserts user, and sets auth cookies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/oauth2/token")) {
          return new Response(JSON.stringify({ access_token: "discord-access" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/users/@me")) {
          return new Response(
            JSON.stringify({ id: "discord-99", username: "swanky", global_name: "Swanky" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const database = createMockDb({
      selectResult: [],
      insertResult: [
        {
          id: userId,
          name: "Swanky",
          discordUserId: "discord-99",
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = discordCallback(createMockConfig(database, createMockLogger()));

    await route.handler(
      {
        query: { code: "auth-code", state: "state-value" },
        headers: { cookie: `${OAUTH_STATE_COOKIE}=state-value` },
      },
      res,
    );

    expect(state.statusCode).toBe(302);
    expect(state.redirectUrl).toBe("http://localhost:3000/");
    expect(
      state.cookies.some((cookie: string) => cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`)),
    ).toBe(true);
    expect(
      state.cookies.some((cookie: string) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`)),
    ).toBe(true);
  });

  it("rejects callback when oauth state mismatches", async () => {
    const { res, state } = createMockResponse();
    const route = discordCallback(createMockConfig());

    await route.handler(
      {
        query: { code: "auth-code", state: "wrong" },
        headers: { cookie: `${OAUTH_STATE_COOKIE}=expected` },
      },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("refreshes tokens with a valid refresh cookie", async () => {
    const presented = "old-refresh-token";
    const database = createMockDb({
      selectResults: [
        [
          {
            id: refreshRowId,
            userId,
            tokenHash: hashToken(presented),
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            createdAt: new Date(),
          },
        ],
        [{ id: userId, discordUserId: "discord-1" }],
      ],
      insertResult: [],
      updateResult: [],
    });
    const { res, state } = createMockResponse();
    const route = refreshAuth(createMockConfig(database));

    await route.handler(
      {
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${presented}` },
      },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true });
    expect(
      state.cookies.some((cookie: string) => cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`)),
    ).toBe(true);
    expect(
      state.cookies.some((cookie: string) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`)),
    ).toBe(true);
  });

  it("logs out and clears cookies", async () => {
    const database = createMockDb();
    const { res, state } = createMockResponse();
    const route = logout(createMockConfig(database));

    await route.handler(
      {
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=to-revoke` },
      },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true });
    expect(database.update).toHaveBeenCalled();
    expect(state.cookies.length).toBeGreaterThanOrEqual(2);
  });

  it("returns the current user for a valid access cookie", async () => {
    const accessToken = await signAccessToken({ sub: userId, discordUserId: "discord-1" });
    const database = createMockDb({
      selectResult: [
        {
          id: userId,
          name: "Ryan",
          discordUserId: "discord-1",
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = getMe(createMockConfig(database));

    await route.handler(
      {
        headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}` },
      },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      id: userId,
      name: "Ryan",
      discordUserId: "discord-1",
    });
  });

  it("returns 401 for /me without an access cookie", async () => {
    const { res, state } = createMockResponse();
    const route = getMe(createMockConfig());

    await route.handler({}, res);

    expect(state.statusCode).toBe(401);
    expect(state.body).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
});
