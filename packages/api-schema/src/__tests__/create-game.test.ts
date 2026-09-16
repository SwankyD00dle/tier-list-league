import { describe, expect, it } from "vitest";
import { createGameBodySchema, isCreateGameRequest } from "../index";

describe("game creation identity", () => {
  it("requires settings only; the server supplies identity and membership", () => {
    const body = { name: "Season", description: "Friends", roundCount: 2 };
    expect(isCreateGameRequest({ body })).toBe(true);
    expect(
      createGameBodySchema.parse({ ...body, createdBy: "untrusted", participants: ["untrusted"] }),
    ).toEqual(body);
  });
});
