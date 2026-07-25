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
  selectResults?: unknown[][];
  insertResult?: unknown[];
  updateResult?: unknown[];
  executeError?: Error;
}): typeof db {
  const selectResults = [...(options?.selectResults ?? [options?.selectResult ?? []])];
  const insertResult = options?.insertResult ?? [];
  const updateResult = options?.updateResult ?? [];

  const createSelectChain = (selectResult: unknown[]) => {
    const promise = Promise.resolve(selectResult);
    return Object.assign(promise, {
      where: () => createSelectChain(selectResult),
      limit: () => promise,
      orderBy: () => promise,
    });
  };

  const database = {
    select: vi.fn(() => ({
      from: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(insertResult)),
      })),
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
