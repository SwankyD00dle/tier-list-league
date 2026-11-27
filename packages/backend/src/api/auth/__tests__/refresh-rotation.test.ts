import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { db } from "../../../database/client";
import { resetAuthConfigCache } from "../../routes/auth/config";
import { createRefreshToken, hashToken, rotateRefreshToken } from "../tokens";

const userId = "550e8400-e29b-41d4-a716-446655440000";

describe("refresh rotation database behavior", () => {
  const pg = new PGlite();
  const queries: string[] = [];
  // The production functions use the shared PostgreSQL query API.
  const database = drizzle({
    client: pg,
    logger: { logQuery: (query) => queries.push(query) },
  }) as unknown as typeof db;

  beforeAll(async () => {
    await pg.exec(`CREATE TABLE refresh_token (
      refresh_token_id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      token_hash text UNIQUE NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  });

  beforeEach(async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "test-client");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "test-secret");
    vi.stubEnv("DISCORD_REDIRECT_URI", "http://localhost/callback");
    vi.stubEnv("JWT_SECRET", "test-secret");
    vi.stubEnv("REFRESH_TOKEN_TTL_SECONDS", "3600");
    resetAuthConfigCache();
    await pg.exec("TRUNCATE refresh_token");
    queries.length = 0;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    resetAuthConfigCache();
    await pg.close();
  });

  it("redeems one token only once across competing calls", async () => {
    const original = await createRefreshToken(database, userId);
    const results = await Promise.all([
      rotateRefreshToken(database, original.token),
      rotateRefreshToken(database, original.token),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const { rows } = await pg.query("SELECT * FROM refresh_token WHERE revoked_at IS NULL");
    expect(rows).toHaveLength(1);
    // PGlite serializes transactions; also assert production emits a PostgreSQL row lock.
    expect(queries.some((query) => /select .*for update/i.test(query))).toBe(true);
    expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
    const replacement = results.find((result) => result !== undefined);
    if (!replacement) throw new Error("Expected one successful rotation");
    expect(await rotateRefreshToken(database, replacement.token)).toMatchObject({ userId });
  });

  it("rolls back consumption if replacement creation fails", async () => {
    const original = await createRefreshToken(database, userId);
    await pg.exec(`CREATE FUNCTION reject_refresh_insert() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'simulated insert failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_refresh BEFORE INSERT ON refresh_token
      FOR EACH ROW EXECUTE FUNCTION reject_refresh_insert()`);
    try {
      await expect(rotateRefreshToken(database, original.token)).rejects.toThrow();
      const { rows } = await pg.query<{ revoked_at: Date | null }>(
        "SELECT revoked_at FROM refresh_token WHERE token_hash = $1",
        [hashToken(original.token)],
      );
      expect(rows[0]?.revoked_at).toBeNull();
    } finally {
      await pg.exec(
        "DROP TRIGGER reject_refresh ON refresh_token; DROP FUNCTION reject_refresh_insert()",
      );
    }
    expect(await rotateRefreshToken(database, original.token)).toMatchObject({ userId });
  });

  it("rejects expired and revoked rows without creating replacements", async () => {
    const original = await createRefreshToken(database, userId);
    await pg.exec("UPDATE refresh_token SET expires_at = now() - interval '1 second'");
    expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
    expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
    const { rows } = await pg.query("SELECT * FROM refresh_token");
    expect(rows).toHaveLength(1);
  });
});
