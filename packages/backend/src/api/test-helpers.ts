import { vi } from "vitest";
import type { db } from "../database/client";
import type { BaseHandlerConfig, Logger } from "./handler";
import type { ApiRequest, ApiResponse } from "./route-helper";

export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

export function createMockResponse<TSuccess>() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  };

  const res: ApiResponse<TSuccess> = {
    status(code) {
      state.statusCode = code;
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
  insertResult?: unknown[];
  executeError?: Error;
}): typeof db {
  const selectResult = options?.selectResult ?? [];
  const insertResult = options?.insertResult ?? [];

  const createSelectChain = () => {
    const promise = Promise.resolve(selectResult);
    return Object.assign(promise, {
      where: () => createSelectChain(),
      limit: () => promise,
    });
  };

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => createSelectChain()),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(insertResult)),
      })),
    })),
    execute: vi.fn(() =>
      options?.executeError ? Promise.reject(options.executeError) : Promise.resolve(undefined),
    ),
  } as unknown as typeof db;
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
