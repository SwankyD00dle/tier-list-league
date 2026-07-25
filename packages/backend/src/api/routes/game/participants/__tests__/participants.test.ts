import { describe, expect, it } from "vitest";
import { createMockConfig, createMockDb, createMockResponse } from "../../../../test-helpers";
import { addParticipant } from "../create";
import { removeParticipant } from "../delete";

const gameId = "550e8400-e29b-41d4-a716-446655440000";
const existingId = "550e8400-e29b-41d4-a716-446655440001";
const newUserId = "550e8400-e29b-41d4-a716-446655440002";

describe("participants", () => {
  it("adds a participant", async () => {
    const database = createMockDb({
      selectResults: [[{ participants: [existingId] }], [{ id: newUserId }]],
    });
    const { res, state } = createMockResponse();

    await addParticipant(createMockConfig(database)).handler(
      { params: { gameId }, body: { userId: newUserId } },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      gameId,
      participants: [existingId, newUserId],
    });
  });

  it("rejects an existing participant with 409", async () => {
    const database = createMockDb({ selectResult: [{ participants: [newUserId] }] });
    const { res, state } = createMockResponse();

    await addParticipant(createMockConfig(database)).handler(
      { params: { gameId }, body: { userId: newUserId } },
      res,
    );

    expect(state.statusCode).toBe(409);
    expect(state.body).toEqual({
      ok: false,
      code: "ALREADY_PARTICIPANT",
      message: "User already participates in this game",
    });
  });

  it("removes a participant", async () => {
    const database = createMockDb({
      selectResult: [{ participants: [existingId, newUserId] }],
    });
    const { res, state } = createMockResponse();

    await removeParticipant(createMockConfig(database)).handler(
      { params: { gameId, userId: newUserId } },
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true, gameId, participants: [existingId] });
  });

  it("returns 404 when removing a non-participant", async () => {
    const database = createMockDb({ selectResult: [{ participants: [existingId] }] });
    const { res, state } = createMockResponse();

    await removeParticipant(createMockConfig(database)).handler(
      { params: { gameId, userId: newUserId } },
      res,
    );

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "User does not participate in this game",
    });
  });
});
