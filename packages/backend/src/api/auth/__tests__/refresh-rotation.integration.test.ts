import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { resetAuthConfigCache } from "../../routes/auth/config";
import { createRefreshToken, hashToken, revokeRefreshToken, rotateRefreshToken } from "../tokens";

const userId = "550e8400-e29b-41d4-a716-446655440000";

describe("refresh rotation database behavior", () => {
  const url = inject("testDatabaseUrl");
  const schema = `refresh_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(url, { max: 1 });
  const sql = postgres(url, {
    max: 4,
    connection: { search_path: schema, application_name: schema },
  });
  const database = drizzle({ client: sql });

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    await sql.unsafe(`CREATE TABLE refresh_token (
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
    await sql.unsafe("TRUNCATE refresh_token");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    resetAuthConfigCache();
    await sql.end();
    try {
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });

  it("redeems one token only once across competing calls", async () => {
    const original = await createRefreshToken(database, userId);
    // Hold the row so both separate connections must contend for its lock.
    const blocker = await sql.reserve();
    await blocker`BEGIN`;
    await blocker`SELECT * FROM refresh_token WHERE token_hash = ${hashToken(original.token)} FOR UPDATE`;
    const competing = Promise.all([
      rotateRefreshToken(database, original.token),
      rotateRefreshToken(database, original.token),
    ]);
    // Observe rejection immediately too, even while polling the lock waiters.
    void competing.catch(() => {});
    try {
      await vi.waitFor(
        async () => {
          const [row] = await admin<{ count: number }[]>`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE application_name = ${schema} AND wait_event_type = 'Lock'`;
          expect(row?.count).toBe(2);
        },
        { timeout: 5000, interval: 20 },
      );
    } finally {
      await blocker`ROLLBACK`;
      blocker.release();
      await competing;
    }
    const results = await competing;
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows = await sql`SELECT * FROM refresh_token WHERE revoked_at IS NULL`;
    expect(rows).toHaveLength(1);
    expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
    const replacement = results.find((result) => result !== undefined);
    if (!replacement) throw new Error("Expected one successful rotation");
    expect(await rotateRefreshToken(database, replacement.token)).toMatchObject({ userId });
  });

  it("rolls back consumption if replacement creation fails", async () => {
    const original = await createRefreshToken(database, userId);
    await sql.unsafe(`CREATE FUNCTION reject_refresh_insert() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'simulated insert failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_refresh BEFORE INSERT ON refresh_token
      FOR EACH ROW EXECUTE FUNCTION reject_refresh_insert()`);
    try {
      await expect(rotateRefreshToken(database, original.token)).rejects.toThrow();
      const rows = await sql.unsafe<{ revoked_at: Date | null }[]>(
        "SELECT revoked_at FROM refresh_token WHERE token_hash = $1",
        [hashToken(original.token)],
      );
      expect(rows[0]?.revoked_at).toBeNull();
    } finally {
      await sql.unsafe(
        "DROP TRIGGER reject_refresh ON refresh_token; DROP FUNCTION reject_refresh_insert()",
      );
    }
    expect(await rotateRefreshToken(database, original.token)).toMatchObject({ userId });
  });

  it.each(["expired", "revoked"])(
    "rejects %s tokens without creating replacements",
    async (state) => {
      const original = await createRefreshToken(database, userId);
      if (state === "revoked") {
        await revokeRefreshToken(database, original.token);
      } else {
        await sql.unsafe("UPDATE refresh_token SET expires_at = now() - interval '1 second'");
      }
      expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
      expect(await rotateRefreshToken(database, original.token)).toBeUndefined();
      const rows = await sql`SELECT * FROM refresh_token`;
      expect(rows).toHaveLength(1);
    },
  );
});
