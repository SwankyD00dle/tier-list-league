import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthConfigCache } from "../../routes/auth/config";
import { createMockDb } from "../../test-helpers";
import {
  createRefreshToken,
  hashToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "../tokens";

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

  it("rotates a valid refresh token", async () => {
    const presented = "refresh-token-value";
    const database = createMockDb({
      selectResult: [
        {
          id: refreshRowId,
          userId,
          tokenHash: hashToken(presented),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ],
      insertResult: [],
      updateResult: [],
    });

    const rotated = await rotateRefreshToken(database, presented);

    expect(rotated).toMatchObject({ userId });
    expect(rotated?.token).toBeTruthy();
    expect(rotated?.token).not.toBe(presented);
    expect(database.update).toHaveBeenCalled();
    expect(database.insert).toHaveBeenCalled();
  });

  it("rejects an expired refresh token", async () => {
    const presented = "expired-refresh";
    const database = createMockDb({
      selectResult: [
        {
          id: refreshRowId,
          userId,
          tokenHash: hashToken(presented),
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ],
    });

    expect(await rotateRefreshToken(database, presented)).toBeUndefined();
    expect(database.update).toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
  });

  it("revokes a refresh token", async () => {
    const database = createMockDb();
    await revokeRefreshToken(database, "to-revoke");
    expect(database.update).toHaveBeenCalled();
  });
});
