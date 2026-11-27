import { afterEach, describe, expect, it, vi } from "vitest";
import type { Round } from "../../../../database/schema/round";
import { createMockConfig, createMockDb } from "../../../test-helpers";
import { advanceExpiredRound, processRoundDeadline, startDeadlineWorker } from "../deadlines";

const now = new Date("2026-11-27T12:00:00Z");
const current: Round = {
  id: "round",
  game: "game",
  roundNumber: 1,
  hostedBy: "host",
  phase: "guessing",
  pendingGuessers: ["player"],
  topic: "Topic",
  tierList: "list",
  guesses: [],
  winningGuess: null,
  honorableMentions: null,
  honorableMentionDetails: [],
  scoreDeltas: {},
  participantTierLists: ["participant-list"],
  createdAt: new Date("2026-11-26T12:00:00Z"),
  updatedAt: null,
  endsAt: now,
  guessingDurationMs: 86_400_000,
};

afterEach(() => vi.useRealTimers());

describe("round deadlines", () => {
  it("opens judging at the exact cutoff when guesses exist", async () => {
    const events: unknown[] = [];
    const db = createMockDb({ onInsertValues: (value) => events.push(value) });
    const updated = await db.transaction((tx) =>
      advanceExpiredRound(tx, { ...current, guesses: ["guess"] }, ["host", "player"], now),
    );
    expect(updated).toMatchObject({
      phase: "judging",
      hostedBy: "host",
      pendingGuessers: [],
      endsAt: now,
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        actor: null,
        kind: "deadline_expired",
        payload: expect.objectContaining({ outcome: "judging" }),
      }),
    );
  });

  it("hands an empty round to the next player and clears old lists", async () => {
    const db = createMockDb();
    const updated = await db.transaction((tx) =>
      advanceExpiredRound(tx, current, ["host", "player"], now),
    );
    expect(updated).toMatchObject({
      phase: "awaiting_host",
      hostedBy: "player",
      tierList: null,
      participantTierLists: [],
      pendingGuessers: [],
      endsAt: null,
      guessingDurationMs: 86_400_000,
    });
    await db.transaction((tx) => advanceExpiredRound(tx, updated, ["host", "player"], now));
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("leaves host assignment to the admin when no other player exists", async () => {
    const db = createMockDb();
    const updated = await db.transaction((tx) => advanceExpiredRound(tx, current, ["host"], now));
    expect(updated).toMatchObject({ phase: "awaiting_host", hostedBy: null });
  });

  it.each([
    { ...current, endsAt: null },
    { ...current, endsAt: new Date(now.getTime() + 1) },
    { ...current, phase: "judging" as const },
    { ...current, phase: "finalized" as const },
  ])("does not expire a round outside its cutoff or guessing phase", async (value) => {
    const db = createMockDb();
    expect(
      await db.transaction((tx) => advanceExpiredRound(tx, value, ["host", "player"], now)),
    ).toEqual(value);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rechecks the current row inside the transaction", async () => {
    const db = createMockDb({ selectResult: [{ ...current, phase: "judging" }] });
    await processRoundDeadline(db, current.id);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("sweeps on startup and every 30 seconds, and stops cleanly", async () => {
    vi.useFakeTimers();
    const db = createMockDb();
    const stop = startDeadlineWorker(createMockConfig(db));
    await vi.advanceTimersByTimeAsync(0);
    expect(db.select).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.select).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});
