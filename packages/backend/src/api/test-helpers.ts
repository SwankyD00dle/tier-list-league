import type { SQL } from "drizzle-orm";
import { vi } from "vitest";
import type { db } from "../database/client";
import { ACCESS_TOKEN_COOKIE } from "./auth/cookies";
import { signAccessToken } from "./auth/tokens";
import type { BaseHandlerConfig, Logger } from "./handler";
import type { ApiRequest, ApiResponse } from "./route-helper";
import { resetAuthConfigCache } from "./routes/auth/config";

export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

export function createMockResponse<TSuccess>() {
  const state: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    cookies: string[];
    redirectUrl: string | undefined;
  } = {
    statusCode: 200,
    body: undefined,
    headers: {},
    cookies: [],
    redirectUrl: undefined,
  };

  const res: ApiResponse<TSuccess> = {
    status(code) {
      state.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      state.headers[name.toLowerCase()] = value;
      return res;
    },
    setCookie(name, value, options) {
      const parts = [`${name}=${encodeURIComponent(value)}`];
      if (options?.maxAge !== undefined) {
        parts.push(`Max-Age=${options.maxAge}`);
      }
      if (options?.path) {
        parts.push(`Path=${options.path}`);
      }
      if (options?.httpOnly) {
        parts.push("HttpOnly");
      }
      if (options?.secure) {
        parts.push("Secure");
      }
      if (options?.sameSite) {
        parts.push(`SameSite=${options.sameSite}`);
      }
      state.cookies.push(parts.join("; "));
      return res;
    },
    clearCookie(name, options) {
      return res.setCookie(name, "", { ...options, maxAge: 0 });
    },
    redirect(url) {
      if (state.statusCode === 200) {
        state.statusCode = 302;
      }
      state.redirectUrl = url;
      state.headers.location = url;
      return res;
    },
    json(body) {
      state.body = body;
      return res;
    },
  };

  return { res, state };
}

export function createMockDb(options?: {
  selectResult?: unknown[];
  selectResults?: unknown[][];
  insertResult?: unknown[];
  updateResult?: unknown[];
  executeError?: Error;
  onSelectWhere?: (condition: SQL | undefined) => void;
  onInsertValues?: (values: unknown) => void;
}): typeof db {
  const selectResults = [...(options?.selectResults ?? [options?.selectResult ?? []])];
  const insertResult = options?.insertResult ?? [];
  const updateResult = options?.updateResult ?? [];

  const createSelectChain = (selectResult: unknown[]) => {
    const promise = Promise.resolve(selectResult);
    return Object.assign(promise, {
      where: vi.fn((condition: SQL | undefined) => {
        options?.onSelectWhere?.(condition);
        return createSelectChain(selectResult);
      }),
      innerJoin: () => createSelectChain(selectResult),
      limit: () => promise,
      orderBy: () => promise,
    });
  };

  const database = {
    select: vi.fn(() => ({
      from: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        options?.onInsertValues?.(values);
        return { returning: vi.fn(() => Promise.resolve(insertResult)) };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() =>
          Object.assign(Promise.resolve(), {
            returning: () => Promise.resolve(updateResult),
          }),
        ),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    execute: vi.fn(() =>
      options?.executeError ? Promise.reject(options.executeError) : Promise.resolve(undefined),
    ),
    transaction: vi.fn(async (callback: (transaction: typeof db) => Promise<unknown>) =>
      callback(database as unknown as typeof db),
    ),
  };

  return database as unknown as typeof db;
}

export function createMockConfig(
  database: typeof db = createMockDb(),
  log: Logger = createMockLogger(),
): BaseHandlerConfig {
  return { db: database, log };
}

export function emptyRequest(): ApiRequest {
  return {};
}

/** Real signed cookies for gameplay route tests; no auth middleware is mocked. */
export async function authenticatedRequest(
  req: ApiRequest = {},
  userId = "550e8400-e29b-41d4-a716-446655440000",
): Promise<ApiRequest> {
  vi.stubEnv("DISCORD_CLIENT_ID", "test-client");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("DISCORD_REDIRECT_URI", "http://localhost:3000/api/auth/discord/callback");
  vi.stubEnv("JWT_SECRET", "test-only-jwt-secret-with-at-least-32-characters");
  resetAuthConfigCache();
  return {
    ...req,
    headers: {
      ...req.headers,
      cookie: `${ACCESS_TOKEN_COOKIE}=${await signAccessToken({ sub: userId, discordUserId: "test-discord-user" })}`,
    },
  };
}
