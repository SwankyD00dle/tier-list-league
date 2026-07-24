import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockLogger,
  createMockResponse,
} from "../../../test-helpers";
import { createUser } from "../create";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("createUser", () => {
  it("creates a user and returns 201", async () => {
    const database = createMockDb({
      insertResult: [
        {
          id: userId,
          name: "Ryan",
          discordUserId: "123",
          createdAt,
        },
      ],
    });
    const log = createMockLogger();
    const { res, state } = createMockResponse();
    const route = createUser(createMockConfig(database, log));

    await route.handler(
      {
        body: {
          name: "Ryan",
          discordUserId: "123",
          games: [],
        },
      },
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(state.body).toEqual({
      ok: true,
      id: userId,
      name: "Ryan",
      discordUserId: "123",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(log.info).toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const { res, state } = createMockResponse();
    const route = createUser(createMockConfig());

    await route.handler(
      {
        body: {
          name: "",
          discordUserId: "123",
          games: [],
        },
      },
      res,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });

  it("returns 500 when insert returns nothing", async () => {
    const { res, state } = createMockResponse();
    const route = createUser(createMockConfig(createMockDb({ insertResult: [] })));

    await route.handler(
      {
        body: {
          name: "Ryan",
          discordUserId: "123",
          games: [],
        },
      },
      res,
    );

    expect(state.statusCode).toBe(500);
    expect(state.body).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Failed to create user",
    });
  });
});
