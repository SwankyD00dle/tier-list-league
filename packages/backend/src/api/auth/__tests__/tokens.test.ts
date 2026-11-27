import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthConfigCache } from "../../routes/auth/config";
import { createMockDb } from "../../test-helpers";
import {
  createRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "../tokens";

const userId = "550e8400-e29b-41d4-a716-446655440000";

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

describe("auth tokens", () => {
  beforeEach(() => {
    setAuthEnv();
  });

  afterEach(() => {
    resetAuthConfigCache();
    vi.restoreAllMocks();
  });

  it("signs and verifies an access token", async () => {
    const token = await signAccessToken({ sub: userId, discordUserId: "discord-1" });
    const payload = await verifyAccessToken(token);

    expect(payload).toEqual({ sub: userId, discordUserId: "discord-1" });
  });

  it("returns undefined for an invalid access token", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeUndefined();
  });

  it("creates a hashed refresh token row", async () => {
    const database = createMockDb({ insertResult: [] });
    const { token, expiresAt } = await createRefreshToken(database, userId);

    expect(token.length).toBeGreaterThan(10);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(database.insert).toHaveBeenCalled();
  });

  it("revokes a refresh token", async () => {
    const database = createMockDb();
    await revokeRefreshToken(database, "to-revoke");
    expect(database.update).toHaveBeenCalled();
  });
});
