import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { getTierList } from "../get";

const tierListId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");
const emptyTiers = {
  SS: [],
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
  E: [],
  F: [],
};

describe("getTierList", () => {
  it("returns a tier list by id", async () => {
    const database = createMockDb({
      selectResult: [
        {
          id: tierListId,
          createdBy: null,
          data: emptyTiers,
          createdAt,
          updatedAt,
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = getTierList(createMockConfig(database));

    await route.handler({ params: { id: tierListId } }, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      tierList: {
        id: tierListId,
        createdBy: null,
        data: emptyTiers,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("returns 404 when the tier list is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getTierList(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler({ params: { id: tierListId } }, res);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Tier list not found",
    });
  });

  it("returns 400 for an invalid id", async () => {
    const { res, state } = createMockResponse();
    const route = getTierList(createMockConfig());

    await route.handler({ params: { id: "bad" } }, res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });

  it("returns 400 when id is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getTierList(createMockConfig());

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });
});
