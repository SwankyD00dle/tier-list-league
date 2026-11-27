import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type {
  CreateGameResponse,
  GetGameResponse,
  GetRoundGuessesResponse,
  GetRoundResponse,
  RecordGameScoreResponse,
  SubmitGuessResponse,
} from "@tier-list-league/api-schema";
import {
  isGetGameResponse,
  isGetRoundResponse,
  isRecordGameScoreResponse,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, inject, it, vi } from "vitest";
import roundEvent from "../../../../database/schema/round-event";
import scoreEntry from "../../../../database/schema/score-entry";
import user from "../../../../database/schema/user";
import { signAccessToken } from "../../../auth/tokens";
import { createRouter } from "../../../router";
import { createMockLogger } from "../../../test-helpers";
import { resetAuthConfigCache } from "../../auth/config";
import { buildRoutes } from "../../index";

describe("complete games over HTTP and PostgreSQL", () => {
  const url = inject("testDatabaseUrl");
  const databaseName = `game_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(url, { max: 1 });
  const databaseUrl = new URL(url);
  databaseUrl.pathname = `/${databaseName}`;
  const connection = postgres(databaseUrl.toString(), { max: 10 });
  const db = drizzle({ client: connection });
  const players = Array.from({ length: 10 }, (_, index) => ({
    id: String(randomUUID()),
    name: `Game test ${index}`,
    discordUserId: randomUUID(),
  }));
  function player(index: number) {
    const value = players[index];
    assert(value);
    return value;
  }
  let cookies: string[] = [];
  let origin: string;
  const router = createRouter(buildRoutes({ db, log: createMockLogger() }));
  const server = createServer((request, response) => {
    void router(request, response).catch((error) => {
      response.statusCode = 500;
      response.end(String(error));
    });
  });
  beforeAll(async () => {
    // The initial migration explicitly references public, so use a separate database.
    await admin.unsafe(`CREATE DATABASE ${databaseName} TEMPLATE template0 ENCODING 'UTF8'`);
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../../../drizzle", import.meta.url)),
    });
    for (const [key, value] of Object.entries({
      JWT_SECRET: randomUUID() + randomUUID(),
      DISCORD_CLIENT_ID: "local-test",
      DISCORD_CLIENT_SECRET: "local-test",
      DISCORD_REDIRECT_URI: "http://localhost/callback",
      ACCESS_TOKEN_TTL_SECONDS: "3600",
    }))
      vi.stubEnv(key, value);
    resetAuthConfigCache();
    await db.insert(user).values(players);
    cookies = await Promise.all(
      players.map(
        async (player) =>
          `access_token=${await signAccessToken({ sub: player.id, discordUserId: player.discordUserId })}`,
      ),
    );
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert(address && typeof address === "object");
    origin = `http://127.0.0.1:${address.port}/api`;
  });
  afterAll(async () => {
    try {
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    } finally {
      try {
        await connection.end();
      } finally {
        try {
          await admin.unsafe(`DROP DATABASE IF EXISTS ${databaseName}`);
        } finally {
          await admin.end();
          vi.unstubAllEnvs();
          resetAuthConfigCache();
        }
      }
    }
  });
  async function call<T = unknown>(
    actor: number,
    method: string,
    path: string,
    body?: unknown,
    expected: number | number[] = 200,
  ) {
    const response = await fetch(origin + path, {
      method,
      headers: { cookie: cookies[actor], "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    assert(
      (Array.isArray(expected) ? expected : [expected]).includes(response.status),
      `${method} ${path}: ${JSON.stringify(result)}`,
    );
    return result as T;
  }
  const tiers = { SS: ["Pizza"], S: ["Tacos"], A: [], B: [], C: [], D: [], E: [], F: [] };
  async function createGame(count: number, pointsTarget: number | null = null) {
    const result = await call<CreateGameResponse>(
      0,
      "POST",
      "/games",
      {
        name: "Local full-game verification",
        description: "Disposable PostgreSQL integration fixture",
        roundCount: 1,
        pointsTarget,
        timeoutDays: 2,
      },
      201,
    );
    assert(isGetGameResponse(result));
    for (let index = 1; index < count; index++)
      await call(0, "POST", `/games/${result.game.id}/participants`, { userId: player(index).id });
    const started = await call<GetRoundResponse>(
      0,
      "POST",
      `/games/${result.game.id}/rounds`,
      { topic: "Food", hostedBy: player(0).id, expectedRoundCount: 0 },
      201,
    );
    return { gameId: result.game.id, round: started.round };
  }
  function indexOf(id: string) {
    const index = players.findIndex((player) => player.id === id);
    assert(index >= 0);
    return index;
  }
  async function submitAll(current: GetRoundResponse["round"], roster: number[]) {
    const host = indexOf(current.hostedBy ?? "");
    await call(host, "PATCH", `/rounds/${current.id}`, { topic: "Host's chosen topic" });
    await call(
      host,
      "POST",
      `/rounds/${current.id}/tier-lists`,
      { userId: player(host).id, data: tiers },
      201,
    );
    const opened = await call<GetRoundResponse>(host, "GET", `/rounds/${current.id}`);
    assert(opened.round.endsAt && new Date(opened.round.endsAt).getTime() > Date.now());
    const guesses = await Promise.all(
      roster
        .filter((actor) => actor !== host)
        .map(async (actor) => ({
          actor,
          ...(
            await call<SubmitGuessResponse>(
              actor,
              "POST",
              `/rounds/${current.id}/guesses`,
              { userId: player(actor).id, data: `Answer ${actor}` },
              201,
            )
          ).guess,
        })),
    );
    const judging = await call<GetRoundResponse>(host, "GET", `/rounds/${current.id}`);
    assert(isGetRoundResponse(judging));
    assert.equal(judging.round.phase, "judging");
    assert.equal(judging.round.guesses.length, guesses.length);
    return { host, guesses };
  }
  async function award(
    gameId: string,
    current: GetRoundResponse["round"],
    winner: number,
    roster: number[],
    concurrent = false,
  ) {
    const { host, guesses } = await submitAll(current, roster);
    const winnerGuess = guesses.find((guess) => guess.actor === winner);
    assert(winnerGuess);
    const body = {
      round: {
        id: current.id,
        hostedBy: player(host).id,
        winningGuess: winnerGuess.id,
        honorableMentions: [],
      },
    };
    const firstResults = await Promise.all(
      Array.from({ length: concurrent ? 3 : 1 }, () =>
        call<RecordGameScoreResponse>(host, "POST", `/games/${gameId}/score`, body),
      ),
    );
    const result = firstResults[0];
    assert(result);
    for (const response of firstResults) assert.equal(response.nextRound?.id, result.nextRound?.id);
    assert(isRecordGameScoreResponse(result));
    const retries = await Promise.all(
      Array.from({ length: concurrent ? 3 : 1 }, () =>
        call<RecordGameScoreResponse>(host, "POST", `/games/${gameId}/score`, body),
      ),
    );
    for (const retry of retries) assert.equal(retry.nextRound?.id, result.nextRound?.id);
    await call(
      host,
      "POST",
      `/games/${gameId}/score`,
      {
        round: {
          ...body.round,
          honorableMentions: [
            {
              guessId: guesses.find((guess) => guess.id !== winnerGuess.id)?.id ?? randomUUID(),
              title: "Changed",
            },
          ],
        },
      },
      409,
    );
    return result;
  }
  it("finishes hosting quotas with joint winners and idempotent concurrent scoring", async () => {
    const regular = await createGame(3);
    await call(0, "PATCH", `/games/${regular.gameId}`, { timeoutDays: 4 }, 409);
    let current = regular.round;
    for (const winner of [1, 2, 0]) {
      const result = await award(regular.gameId, current, winner, [0, 1, 2], true);
      if (result.nextRound) {
        assert.equal(result.nextRound.hostedBy, player(winner).id);
        current = result.nextRound;
      } else {
        assert.equal(result.game.status, "finished");
        assert.deepEqual(
          [...result.game.winnerIds].sort(),
          players
            .slice(0, 3)
            .map((player) => player.id)
            .sort(),
        );
      }
    }
    const finished = await call<GetGameResponse>(0, "GET", `/games/${regular.gameId}`);
    assert.equal(finished.game.rounds.length, 3);
    assert(finished.game.finishedAt);
    await call(
      0,
      "POST",
      `/games/${regular.gameId}/rounds`,
      { topic: "Extra", hostedBy: player(0).id },
      409,
    );
    await call(0, "POST", `/games/${regular.gameId}/participants`, { userId: player(3).id }, 409);
    await call(
      0,
      "POST",
      `/rounds/${current.id}/guesses`,
      { userId: player(0).id, data: "Late" },
      409,
    );
    assert.equal(
      (await call<GetRoundGuessesResponse>(0, "GET", `/rounds/${current.id}/guesses`)).guesses
        .length,
      2,
    );
    const [profile] = await db
      .select()
      .from(user)
      .where(eq(user.id, player(0).id));
    assert(profile);
    assert(!profile.activeGames.includes(regular.gameId));
  });
  it("finishes at the points target and selects an unhosted player after repeat wins", async () => {
    const points = await createGame(4, 9);
    let current = points.round;
    for (const [turn, winner] of [1, 0, 1, 1].entries()) {
      const result = await award(points.gameId, current, winner, [0, 1, 2, 3]);
      if (turn === 3) {
        assert.equal(result.game.status, "finished");
        assert.equal(result.nextRound, null);
      }
      if (turn === 2)
        assert([player(2).id, player(3).id].includes(result.nextRound?.hostedBy ?? ""));
      if (result.nextRound) current = result.nextRound;
      else {
        assert.equal(result.game.status, "finished");
        assert.deepEqual(result.game.winnerIds, [player(1).id]);
      }
    }
  });
  it("enforces honorable-mention limits and preserves retries", async () => {
    const mentions = await createGame(10, 3);
    const prepared = await submitAll(
      mentions.round,
      Array.from({ length: 10 }, (_, index) => index),
    );
    assert(prepared.guesses[0]);
    assert(prepared.guesses[1]);
    const input = {
      id: mentions.round.id,
      hostedBy: player(0).id,
      winningGuess: prepared.guesses[0].id,
      honorableMentions: prepared.guesses
        .slice(1, 3)
        .map((guess) => ({ guessId: guess.id, title: "Honorable" })),
    };
    await call(0, "POST", `/games/${mentions.gameId}/score`, { round: input }, 400);
    input.honorableMentions.pop();
    const mentioned = await call<RecordGameScoreResponse>(
      0,
      "POST",
      `/games/${mentions.gameId}/score`,
      { round: input },
    );
    assert(prepared.guesses[1].createdBy);
    assert.equal(mentioned.scores[prepared.guesses[1].createdBy]?.total, 1);
    const reordered = await call<RecordGameScoreResponse>(
      0,
      "POST",
      `/games/${mentions.gameId}/score`,
      {
        round: {
          ...input,
          honorableMentions: input.honorableMentions.map(({ guessId, title }) => ({
            title,
            guessId,
          })),
        },
      },
    );
    assert.deepEqual(reordered.scores, mentioned.scores);
  });
  it("rolls back scoring and progression if the finalization event fails", async () => {
    const game = await createGame(3);
    const { guesses } = await submitAll(game.round, [0, 1, 2]);
    assert(guesses[0]);
    const body = {
      round: {
        id: game.round.id,
        hostedBy: player(0).id,
        winningGuess: guesses[0].id,
        honorableMentions: [],
      },
    };
    await connection.unsafe(`CREATE FUNCTION reject_finalization() RETURNS trigger AS $$
      BEGIN IF NEW.kind = 'round_finalized' THEN RAISE EXCEPTION 'simulated event failure'; END IF;
      RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_finalization BEFORE INSERT ON round_event
      FOR EACH ROW EXECUTE FUNCTION reject_finalization()`);
    try {
      await call(0, "POST", `/games/${game.gameId}/score`, body, 500);
      const unchanged = await call<GetGameResponse>(0, "GET", `/games/${game.gameId}`);
      assert.deepEqual(unchanged.game.rounds, [game.round.id]);
      assert.equal(unchanged.game.status, "active");
      const pending = await call<GetRoundResponse>(0, "GET", `/rounds/${game.round.id}`);
      assert.equal(pending.round.phase, "judging");
      assert.equal(pending.round.winningGuess, null);
      const entries = await db.select().from(scoreEntry).where(eq(scoreEntry.game, game.gameId));
      assert.equal(entries.length, 0);
    } finally {
      await connection.unsafe(
        "DROP TRIGGER reject_finalization ON round_event; DROP FUNCTION reject_finalization()",
      );
    }
    const retry = await call<RecordGameScoreResponse>(
      0,
      "POST",
      `/games/${game.gameId}/score`,
      body,
    );
    assert(retry.nextRound);
    assert.equal(retry.game.rounds.length, 2);
  });
  it("hands off empty expired rounds and finishes the game", async () => {
    const timed = await createGame(3, 3);
    await call(0, "PATCH", `/rounds/${timed.round.id}`, {
      endsAt: new Date(Date.now() + 1500).toISOString(),
    });
    await call(
      0,
      "POST",
      `/rounds/${timed.round.id}/tier-lists`,
      { userId: player(0).id, data: tiers },
      201,
    );
    await delay(1600);
    await call(
      2,
      "POST",
      `/rounds/${timed.round.id}/guesses`,
      { userId: player(2).id, data: "Late" },
      409,
    );
    const handedOff = (await call<GetRoundResponse>(0, "GET", `/rounds/${timed.round.id}`)).round;
    assert.equal(handedOff.hostedBy, player(1).id);
    assert.equal(handedOff.phase, "awaiting_host");
    const timedResult = await award(timed.gameId, handedOff, 2, [0, 1, 2]);
    assert.equal(timedResult.game.status, "finished");
    const events = await db.select().from(roundEvent).where(eq(roundEvent.round, timed.round.id));
    assert.equal(events.filter((event) => event.kind === "deadline_expired").length, 1);
  });
  it("serializes duplicate guesses and updates pending membership", async () => {
    const membership = await createGame(4, 3);
    await call(
      0,
      "POST",
      `/rounds/${membership.round.id}/tier-lists`,
      { userId: player(0).id, data: tiers },
      201,
    );
    await call(
      0,
      "DELETE",
      `/games/${membership.gameId}/participants/${player(0).id}`,
      undefined,
      409,
    );
    await call(0, "POST", `/games/${membership.gameId}/participants`, { userId: player(4).id });
    await call(
      4,
      "POST",
      `/rounds/${membership.round.id}/guesses`,
      { userId: player(4).id, data: "New" },
      409,
    );
    const duplicates = await Promise.all(
      [1, 2].map(() =>
        call<SubmitGuessResponse>(
          1,
          "POST",
          `/rounds/${membership.round.id}/guesses`,
          { userId: player(1).id, data: "Retry" },
          [200, 201],
        ),
      ),
    );
    assert(duplicates[0] && duplicates[1]);
    assert.equal(duplicates[0].guess.id, duplicates[1].guess.id);
    await call(
      2,
      "POST",
      `/rounds/${membership.round.id}/guesses`,
      { userId: player(2).id, data: "Answer" },
      201,
    );
    await call(0, "DELETE", `/games/${membership.gameId}/participants/${player(3).id}`);
    assert.equal(
      (await call<GetRoundResponse>(0, "GET", `/rounds/${membership.round.id}`)).round.phase,
      "judging",
    );
    const visible = await call<GetRoundGuessesResponse>(
      0,
      "GET",
      `/rounds/${membership.round.id}/guesses`,
    );
    assert(visible.guesses[0]);
    const scored = await call<RecordGameScoreResponse>(
      0,
      "POST",
      `/games/${membership.gameId}/score`,
      {
        round: {
          id: membership.round.id,
          hostedBy: player(0).id,
          winningGuess: visible.guesses[0].id,
          honorableMentions: [],
        },
      },
    );
    assert.equal(scored.game.status, "finished");
  });
});
