import { isGetRoundGuessesResponse } from "@tier-list-league/api-schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  authenticatedRequest,
  createMockConfig,
  createMockDb,
  createMockResponse,
} from "../../../../test-helpers";
import { getRoundGuesses } from "../get";

const roundId = "550e8400-e29b-41d4-a716-446655440000";
const host = "550e8400-e29b-41d4-a716-446655440001";
const player = "550e8400-e29b-41d4-a716-446655440002";
const guessId = "550e8400-e29b-41d4-a716-446655440003";
const other = "550e8400-e29b-41d4-a716-446655440004";
const saved = {
  id: guessId,
  round: roundId,
  createdBy: player,
  data: "Answer",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const baseRound = {
  id: roundId,
  game: roundId,
  hostedBy: host,
  phase: "guessing",
  winningGuess: null,
  guesses: [guessId],
  endsAt: null,
};

describe("getRoundGuesses", () => {
  it.each([
    { phase: "awaiting_host", caller: player, all: false },
    { phase: "guessing", caller: player, all: false },
    { phase: "guessing", caller: host, all: false },
    { phase: "judging", caller: player, all: false },
    { phase: "judging", caller: host, all: true },
    { phase: "finalized", caller: player, all: true },
    { phase: "finalized", caller: host, all: true },
  ])("filters guesses for $caller in $phase", async ({ phase, caller, all }) => {
    const conditions: { sql: string; params: unknown[] }[] = [];
    const database = createMockDb({
      selectResults: [[{ ...baseRound, phase }], [{ participants: [host, player] }], [saved]],
      onSelectWhere: (condition) => {
        if (condition) conditions.push(new PgDialect().sqlToQuery(condition));
      },
    });
    const { res, state } = createMockResponse();
    await getRoundGuesses(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId } }, caller),
      res,
    );
    expect(state.statusCode).toBe(200);
    expect(isGetRoundGuessesResponse(state.body)).toBe(true);
    const filter = conditions.at(-1);
    expect(filter?.params).toEqual(all ? [roundId] : [roundId, caller]);
    expect(filter?.sql.includes('"guess"."user_id"')).toBe(!all);
  });

  it("advances an expired round before allowing the host to judge", async () => {
    const events: unknown[] = [];
    const database = createMockDb({
      selectResults: [
        [{ ...baseRound, endsAt: new Date(0) }],
        [{ participants: [host, player] }],
        [saved],
      ],
      onInsertValues: (value) => events.push(value),
    });
    const { res, state } = createMockResponse();
    await getRoundGuesses(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId } }, host),
      res,
    );
    expect(state.statusCode).toBe(200);
    expect(events).toContainEqual(expect.objectContaining({ kind: "deadline_expired" }));
  });

  it.each([{ participants: [] }, { participants: [host] }])(
    "denies a nonparticipant even if they are the game admin",
    async ({ participants }) => {
      const database = createMockDb({
        selectResults: [[baseRound], [{ createdBy: other, participants }]],
      });
      const { res, state } = createMockResponse();
      await getRoundGuesses(createMockConfig(database)).handler(
        await authenticatedRequest({ params: { roundId } }, other),
        res,
      );
      expect(state.statusCode).toBe(403);
      expect(database.select).toHaveBeenCalledTimes(2);
    },
  );

  it("returns 404 for a missing round", async () => {
    const { res, state } = createMockResponse();
    await getRoundGuesses(createMockConfig(createMockDb())).handler(
      await authenticatedRequest({ params: { roundId } }, player),
      res,
    );
    expect(state.statusCode).toBe(404);
  });

  it("returns an empty list when the player has no visible guess", async () => {
    const database = createMockDb({
      selectResults: [[baseRound], [{ participants: [host, player] }], []],
    });
    const { res, state } = createMockResponse();
    await getRoundGuesses(createMockConfig(database)).handler(
      await authenticatedRequest({ params: { roundId } }, player),
      res,
    );
    expect(state.body).toEqual({ ok: true, guesses: [] });
  });
});
