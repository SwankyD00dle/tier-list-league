import { describe, expect, it } from "vitest";
import roundEvent from "../../../../../database/schema/round-event";
import {
  authenticatedRequest,
  createMockConfig,
  createMockResponse,
  createRoundContextDb,
} from "../../../../test-helpers";
import { submitGuess } from "../create";

const roundId = "550e8400-e29b-41d4-a716-446655440000";
const gameId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440002";
const guessId = "550e8400-e29b-41d4-a716-446655440003";
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const savedGuess = {
  id: guessId,
  round: roundId,
  data: "Pepperoni",
  createdBy: userId,
  createdAt,
  updatedAt: createdAt,
};

describe("submitGuess", () => {
  it("creates a new guess and returns 201", async () => {
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            phase: "guessing",
            pendingGuessers: [userId],
            hostedBy: "host",
            game: gameId,
            guesses: [],
            winningGuess: null,
          },
        ],
        [{ participants: [userId] }],
        [],
      ],
      insertResult: [savedGuess],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId, data: "Pepperoni" } },
        userId,
      ),
      res,
    );

    expect(state.statusCode).toBe(201);
    expect(database.insert).toHaveBeenCalledWith(roundEvent);
    expect(state.body).toMatchObject({ ok: true, guess: { id: guessId, data: "Pepperoni" } });
  });

  it("replaces an existing guess and returns 200", async () => {
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            phase: "guessing",
            pendingGuessers: [userId],
            hostedBy: "host",
            game: gameId,
            guesses: [guessId],
            winningGuess: null,
          },
        ],
        [{ participants: [userId] }],
        [{ id: guessId }],
      ],
      updateResult: [{ ...savedGuess, data: "Pineapple" }],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId, data: "Pineapple" } },
        userId,
      ),
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(database.insert).toHaveBeenCalledWith(roundEvent);
    expect(state.body).toMatchObject({ ok: true, guess: { data: "Pineapple" } });
  });

  it("rejects guesses on a finalized round", async () => {
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            phase: "guessing",
            pendingGuessers: [userId],
            hostedBy: "host",
            game: gameId,
            guesses: [],
            winningGuess: guessId,
          },
        ],
        [{ participants: [userId] }],
      ],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId, data: "Pepperoni" } },
        userId,
      ),
      res,
    );

    expect(state.statusCode).toBe(409);
    expect(state.body).toMatchObject({ ok: false, code: "ROUND_FINALIZED" });
  });

  it("rejects non-participants", async () => {
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            phase: "guessing",
            pendingGuessers: [userId],
            hostedBy: "host",
            game: gameId,
            guesses: [],
            winningGuess: null,
          },
        ],
        [{ participants: [] }],
      ],
    });
    const { res, state } = createMockResponse();

    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest(
        { params: { roundId }, body: { userId, data: "Pepperoni" } },
        userId,
      ),
      res,
    );

    expect(state.statusCode).toBe(403);
    expect(state.body).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

it.each(["awaiting_host", "judging"])(
  "rejects guesses during %s without writing an event",
  async (phase) => {
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            game: gameId,
            phase,
            hostedBy: "host",
            winningGuess: null,
            pendingGuessers: [userId],
            guesses: [],
          },
        ],
        [{ participants: [userId] }],
      ],
    });
    const { res, state } = createMockResponse();
    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId }, body: { userId, data: "Guess" } }, userId),
      res,
    );
    expect(state.statusCode).toBe(409);
    expect(state.body).toMatchObject({ code: "INVALID_PHASE" });
    expect(database.insert).not.toHaveBeenCalled();
  },
);

it.each([{ remaining: [] }, { remaining: ["550e8400-e29b-41d4-a716-446655440009"] }])(
  "updates pending players after a new guess ($remaining)",
  async ({ remaining }) => {
    const updates: unknown[] = [];
    const database = createRoundContextDb({
      selectResults: [
        [
          {
            game: gameId,
            phase: "guessing",
            hostedBy: "host",
            winningGuess: null,
            pendingGuessers: [userId, ...remaining],
            guesses: [],
          },
        ],
        [{ participants: [userId, ...remaining] }],
        [],
      ],
      insertResult: [savedGuess],
      onUpdateSet: (values) => updates.push(values),
    });
    const { res, state } = createMockResponse();
    await submitGuess(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId }, body: { userId, data: "Guess" } }, userId),
      res,
    );
    expect(state.statusCode).toBe(201);
    expect(updates).toContainEqual(
      expect.objectContaining({
        phase: remaining.length ? "guessing" : "judging",
        pendingGuessers: remaining,
      }),
    );
  },
);

it.each([
  { hostedBy: userId, pendingGuessers: [userId], label: "host" },
  { hostedBy: "host", pendingGuessers: [], label: "player added after guessing opened" },
])("rejects a guess from the $label", async ({ hostedBy, pendingGuessers }) => {
  const database = createRoundContextDb({
    selectResults: [
      [
        {
          game: gameId,
          phase: "guessing",
          hostedBy,
          pendingGuessers,
          guesses: [],
          winningGuess: null,
        },
      ],
      [{ participants: [userId] }],
      [],
    ],
  });
  const { res, state } = createMockResponse();
  await submitGuess(createMockConfig(database)).handler(
    await authenticatedRequest({ params: { roundId }, body: { userId, data: "Guess" } }, userId),
    res,
  );
  expect(state.statusCode).toBe(409);
  expect(database.insert).not.toHaveBeenCalled();
});

it("rejects a late guess and commits the deadline transition", async () => {
  const events: unknown[] = [];
  const database = createRoundContextDb({
    selectResults: [
      [
        {
          id: roundId,
          game: gameId,
          phase: "guessing",
          hostedBy: "host",
          winningGuess: null,
          pendingGuessers: [userId],
          guesses: [guessId],
          endsAt: new Date(0),
        },
      ],
      [{ participants: [userId] }],
    ],
    onInsertValues: (values) => events.push(values),
  });
  const { res, state } = createMockResponse();
  await submitGuess(createMockConfig(database)).handler(
    await authenticatedRequest({ params: { roundId }, body: { userId, data: "Too late" } }, userId),
    res,
  );
  expect(state.statusCode).toBe(409);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: "deadline_expired", payload: { outcome: "judging" } });
});
