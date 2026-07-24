import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { getUser } from "../get";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("getUser", () => {
  it("returns a user by id", async () => {
    const database = createMockDb({
      selectResult: [
        {
          id: userId,
          name: "Ryan",
          discordUserId: "123",
          activeGames: [],
          createdAt,
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = getUser(createMockConfig(database));

    await route.handler({ params: { id: userId } }, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      user: {
        id: userId,
        name: "Ryan",
        discordUserId: "123",
        activeGames: [],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns 404 when the user is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getUser(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler({ params: { id: userId } }, res);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("returns 400 for an invalid id", async () => {
    const { res, state } = createMockResponse();
    const route = getUser(createMockConfig());

    await route.handler({ params: { id: "not-a-uuid" } }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });

  it("returns 400 when id is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getUser(createMockConfig());

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });
});
