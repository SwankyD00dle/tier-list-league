import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import type { db } from "../../database/client";
import refreshToken from "../../database/schema/refresh-token";
import { getAuthConfig } from "../routes/auth/config";

export interface AccessTokenPayload {
  sub: string;
  discordUserId: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthConfig().jwtSecret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const { accessTokenTtlSeconds } = getAuthConfig();
  return new SignJWT({ discordUserId: payload.discordUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${accessTokenTtlSeconds}s`)
    .sign(getJwtSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | undefined> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (typeof payload.sub !== "string") {
      return undefined;
    }
    if (typeof payload.discordUserId !== "string") {
      return undefined;
    }
    return { sub: payload.sub, discordUserId: payload.discordUserId };
  } catch {
    return undefined;
  }
}

export async function createRefreshToken(
  database: typeof db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { refreshTokenTtlSeconds } = getAuthConfig();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + refreshTokenTtlSeconds * 1000);

  await database.insert(refreshToken).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function rotateRefreshToken(
  database: typeof db,
  presentedToken: string,
): Promise<{ userId: string; token: string; expiresAt: Date } | undefined> {
  const tokenHash = hashToken(presentedToken);
  const [existing] = await database
    .select()
    .from(refreshToken)
    .where(and(eq(refreshToken.tokenHash, tokenHash), isNull(refreshToken.revokedAt)))
    .limit(1);

  if (!existing) {
    return undefined;
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await database
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(eq(refreshToken.id, existing.id));
    return undefined;
  }

  await database
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(refreshToken.id, existing.id));

  const created = await createRefreshToken(database, existing.userId);
  return { userId: existing.userId, ...created };
}

export async function revokeRefreshToken(
  database: typeof db,
  presentedToken: string,
): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await database
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshToken.tokenHash, tokenHash), isNull(refreshToken.revokedAt)));
}
