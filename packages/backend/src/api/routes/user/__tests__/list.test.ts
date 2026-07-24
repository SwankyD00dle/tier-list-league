import { describe, expect, it } from "vitest";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { listUsers } from "../list";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("listUsers", () => {
  it("returns users from the database", async () => {
    const database = createMockDb({
      selectResult: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Ryan",
          discordUserId: "123",
          activeGames: [],
          createdAt,
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = listUsers(createMockConfig(database));

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      users: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Ryan",
          discordUserId: "123",
          activeGames: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns an empty list when no users exist", async () => {
    const { res, state } = createMockResponse();
    const route = listUsers(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true, users: [] });
  });
});
