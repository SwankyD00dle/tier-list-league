import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_FAILURE_CODE } from "../../../route-helper";
import {
  createMockConfig,
  createMockDb,
  createMockResponse,
  emptyRequest,
} from "../../../test-helpers";
import { getRound } from "../get";

const roundId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("getRound", () => {
  it("returns a round by id", async () => {
    const database = createMockDb({
      selectResult: [
        {
          id: roundId,
          game: null,
          roundNumber: 1,
          hostedBy: null,
          topic: "Best pizza toppings",
          tierList: null,
          guesses: [],
          winningGuess: null,
          honorableMentions: null,
          honorableMentionDetails: [],
          scoreDeltas: {},
          participantTierLists: null,
          createdAt,
          updatedAt: null,
          endsAt: null,
        },
      ],
    });
    const { res, state } = createMockResponse();
    const route = getRound(createMockConfig(database));

    await route.handler({ params: { id: roundId } }, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      round: {
        id: roundId,
        game: null,
        roundNumber: 1,
        hostedBy: null,
        topic: "Best pizza toppings",
        tierList: null,
        guesses: [],
        winningGuess: null,
        honorableMentions: null,
        honorableMentionDetails: [],
        scoreDeltas: {},
        participantTierLists: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
        endsAt: null,
      },
    });
  });

  it("returns 404 when the round is missing", async () => {
    const { res, state } = createMockResponse();
    const route = getRound(createMockConfig(createMockDb({ selectResult: [] })));

    await route.handler({ params: { id: roundId } }, res);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Round not found",
    });
  });

  it("returns 400 for an invalid id", async () => {
    const { res, state } = createMockResponse();
    const route = getRound(createMockConfig());

    await route.handler(emptyRequest(), res);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      ok: false,
      code: REQUEST_SCHEMA_FAILURE_CODE,
    });
  });
});
