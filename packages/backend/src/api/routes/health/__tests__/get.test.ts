import { describe, expect, it } from "vitest";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { healthCheck } from "../get";

describe("healthCheck", () => {
  it("returns ok when the database is reachable", async () => {
    const { res, state } = createMockResponse();
    const route = healthCheck(createMockConfig(createMockDb()));

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ status: "ok" });
  });

  it("returns db_unavailable when the database ping fails", async () => {
    const { res, state } = createMockResponse();
    const route = healthCheck(
      createMockConfig(createMockDb({ executeError: new Error("connection refused") })),
    );

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(503);
    expect(state.body).toEqual({ status: "db_unavailable" });
  });
});
