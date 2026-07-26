import { describe, expect, it } from "vitest";
import * as apiSchema from "../index";
import { isCreateUserRequest, isGetUserRequest, isGetUserResponse } from "../typechecks";

const userId = "11111111-1111-4111-8111-111111111111";

describe("request typechecks", () => {
  it("narrows a request that matches its schema", () => {
    const request: unknown = { params: { id: userId } };

    expect(isGetUserRequest(request)).toBe(true);
    if (isGetUserRequest(request)) {
      expect(request.params.id).toBe(userId);
    }
  });

  it("rejects a request with a malformed param", () => {
    expect(isGetUserRequest({ params: { id: "not-a-uuid" } })).toBe(false);
  });

  it("rejects a request that is missing its body", () => {
    expect(isCreateUserRequest({})).toBe(false);
  });
});

describe("response typechecks", () => {
  it("narrows a response that matches its schema", () => {
    const response: unknown = {
      ok: true,
      user: {
        id: userId,
        name: "Swanky",
        discordUserId: "1234",
        activeGames: [],
        createdAt: "2026-07-26T00:00:00.000Z",
      },
    };

    expect(isGetUserResponse(response)).toBe(true);
    if (isGetUserResponse(response)) {
      expect(response.user.name).toBe("Swanky");
    }
  });

  it("rejects an error envelope", () => {
    expect(isGetUserResponse({ ok: false, code: "NOT_FOUND", message: "User not found" })).toBe(
      false,
    );
  });
});

describe("package surface", () => {
  it("does not export the generic schema matcher", () => {
    expect(Object.keys(apiSchema)).not.toContain("matchesSchema");
  });
});
