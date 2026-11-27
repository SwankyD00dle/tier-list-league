import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
  type GetRoundResponse,
  isGetGameResponse,
  isGetRoundResponse,
  isRecordGameScoreResponse,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { signAccessToken } from "../src/api/auth/tokens";

import roundEvent from "../src/database/schema/round-event";
import user from "../src/database/schema/user";

if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL to a migrated local PostgreSQL test database");
Object.assign(process.env, {
  JWT_SECRET: randomUUID() + randomUUID(),
  DISCORD_CLIENT_ID: "local-test",
  DISCORD_CLIENT_SECRET: "local-test",
  DISCORD_REDIRECT_URI: "http://localhost/callback",
  ACCESS_TOKEN_TTL_SECONDS: "3600",
});
const connection = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: connection });
const players = Array.from({ length: 10 }, (_, index) => ({
  id: randomUUID(),
  name: `Game test ${index}`,
  discordUserId: randomUUID(),
}));
await db.insert(user).values(players);
const cookies = await Promise.all(
  players.map(
    async (player) =>
      `access_token=${await signAccessToken({ sub: player.id, discordUserId: player.discordUserId })}`,
  ),
);
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const address = listener.address();
assert(address && typeof address === "object");
const port = address.port;
await new Promise<void>((resolve) => listener.close(() => resolve()));
const backend = spawn(
  process.execPath,
  ["--import", "tsx", new URL("../src/index.ts", import.meta.url).pathname],
  {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
backend.stdout.on("data", (chunk) => {
  output += chunk;
});
backend.stderr.on("data", (chunk) => {
  output += chunk;
});
const exited = once(backend, "exit");
const origin = `http://127.0.0.1:${port}/api`;
async function call(
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
  return result;
}
const tiers = { SS: ["Pizza"], S: ["Tacos"], A: [], B: [], C: [], D: [], E: [], F: [] };
async function createGame(count: number, pointsTarget: number | null = null) {
  const result = await call(
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
    await call(0, "POST", `/games/${result.game.id}/participants`, { userId: players[index].id });
  const started = await call(
    0,
    "POST",
    `/games/${result.game.id}/rounds`,
    { topic: "Food", hostedBy: players[0].id, expectedRoundCount: 0 },
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
  const host = indexOf(current.hostedBy);
  await call(host, "PATCH", `/rounds/${current.id}`, { topic: "Host's chosen topic" });
  await call(
    host,
    "POST",
    `/rounds/${current.id}/tier-lists`,
    { userId: players[host].id, data: tiers },
    201,
  );
  const opened = await call(host, "GET", `/rounds/${current.id}`);
  assert(opened.round.endsAt && new Date(opened.round.endsAt).getTime() > Date.now());
  const guesses = await Promise.all(
    roster
      .filter((actor) => actor !== host)
      .map(async (actor) => ({
        actor,
        ...(
          await call(
            actor,
            "POST",
            `/rounds/${current.id}/guesses`,
            { userId: players[actor].id, data: `Answer ${actor}` },
            201,
          )
        ).guess,
      })),
  );
  const judging = await call(host, "GET", `/rounds/${current.id}`);
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
      hostedBy: players[host].id,
      winningGuess: winnerGuess.id,
      honorableMentions: [],
    },
  };
  const firstResults = await Promise.all(
    Array.from({ length: concurrent ? 3 : 1 }, () =>
      call(host, "POST", `/games/${gameId}/score`, body),
    ),
  );
  const result = firstResults[0];
  for (const response of firstResults) assert.equal(response.nextRound?.id, result.nextRound?.id);
  assert(isRecordGameScoreResponse(result));
  const retries = await Promise.all(
    Array.from({ length: concurrent ? 3 : 1 }, () =>
      call(host, "POST", `/games/${gameId}/score`, body),
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
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const health = await fetch(`${origin}/health`);
      if (health.ok) break;
    } catch {}
    if (backend.exitCode !== null || attempt === 99)
      throw new Error(`Backend failed to start: ${output}`);
    await delay(100);
  }
  console.log(`Running HTTP game verification at ${origin} against PostgreSQL`);
  const regular = await createGame(3);
  await call(0, "PATCH", `/games/${regular.gameId}`, { timeoutDays: 4 }, 409);
  let current = regular.round;
  for (const winner of [1, 2, 0]) {
    const result = await award(regular.gameId, current, winner, [0, 1, 2], true);
    if (result.nextRound) {
      assert.equal(result.nextRound.hostedBy, players[winner].id);
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
  const finished = await call(0, "GET", `/games/${regular.gameId}`);
  assert.equal(finished.game.rounds.length, 3);
  assert(finished.game.finishedAt);
  await call(
    0,
    "POST",
    `/games/${regular.gameId}/rounds`,
    { topic: "Extra", hostedBy: players[0].id },
    409,
  );
  await call(0, "POST", `/games/${regular.gameId}/participants`, { userId: players[3].id }, 409);
  await call(
    0,
    "POST",
    `/rounds/${current.id}/guesses`,
    { userId: players[0].id, data: "Late" },
    409,
  );
  assert.equal((await call(0, "GET", `/rounds/${current.id}/guesses`)).guesses.length, 2);
  const [profile] = await db.select().from(user).where(eq(user.id, players[0].id));
  assert(!profile.activeGames.includes(regular.gameId));
  console.log(
    "PASS rounds-per-player finish, joint winners, setting locks, retries, concurrent submissions, finalized reveal, active-game cleanup",
  );

  const points = await createGame(4, 9);
  current = points.round;
  for (const [turn, winner] of [1, 0, 1, 1].entries()) {
    const result = await award(points.gameId, current, winner, [0, 1, 2, 3]);
    if (turn === 2)
      assert([players[2].id, players[3].id].includes(result.nextRound?.hostedBy ?? ""));
    if (result.nextRound) current = result.nextRound;
    else {
      assert.equal(result.game.status, "finished");
      assert.deepEqual(result.game.winnerIds, [players[1].id]);
    }
  }
  console.log("PASS points-target finish and random unhosted-player fallback");

  const mentions = await createGame(10, 3);
  const prepared = await submitAll(
    mentions.round,
    Array.from({ length: 10 }, (_, index) => index),
  );
  const input = {
    id: mentions.round.id,
    hostedBy: players[0].id,
    winningGuess: prepared.guesses[0].id,
    honorableMentions: prepared.guesses
      .slice(1, 3)
      .map((guess) => ({ guessId: guess.id, title: "Honorable" })),
  };
  await call(0, "POST", `/games/${mentions.gameId}/score`, { round: input }, 400);
  input.honorableMentions.pop();
  const mentioned = await call(0, "POST", `/games/${mentions.gameId}/score`, { round: input });
  assert.equal(mentioned.scores[prepared.guesses[1].createdBy].total, 1);
  const reordered = await call(0, "POST", `/games/${mentions.gameId}/score`, {
    round: {
      ...input,
      honorableMentions: input.honorableMentions.map(({ guessId, title }) => ({ title, guessId })),
    },
  });
  assert.deepEqual(reordered.scores, mentioned.scores);
  console.log("PASS honorable-mention cap and one-point award");

  const timed = await createGame(3, 3);
  await call(0, "PATCH", `/rounds/${timed.round.id}`, {
    endsAt: new Date(Date.now() + 1500).toISOString(),
  });
  await call(
    0,
    "POST",
    `/rounds/${timed.round.id}/tier-lists`,
    { userId: players[0].id, data: tiers },
    201,
  );
  await delay(1600);
  await call(
    2,
    "POST",
    `/rounds/${timed.round.id}/guesses`,
    { userId: players[2].id, data: "Late" },
    409,
  );
  const handedOff = (await call(0, "GET", `/rounds/${timed.round.id}`)).round;
  assert.equal(handedOff.hostedBy, players[1].id);
  assert.equal(handedOff.phase, "awaiting_host");
  const timedResult = await award(timed.gameId, handedOff, 2, [0, 1, 2]);
  assert.equal(timedResult.game.status, "finished");
  const events = await db.select().from(roundEvent).where(eq(roundEvent.round, timed.round.id));
  assert.equal(events.filter((event) => event.kind === "deadline_expired").length, 1);
  console.log("PASS timeout, zero-guess handoff, renewed deadline, and game completion");

  const membership = await createGame(4, 3);
  await call(
    0,
    "POST",
    `/rounds/${membership.round.id}/tier-lists`,
    { userId: players[0].id, data: tiers },
    201,
  );
  await call(
    0,
    "DELETE",
    `/games/${membership.gameId}/participants/${players[0].id}`,
    undefined,
    409,
  );
  await call(0, "POST", `/games/${membership.gameId}/participants`, { userId: players[4].id });
  await call(
    4,
    "POST",
    `/rounds/${membership.round.id}/guesses`,
    { userId: players[4].id, data: "New" },
    409,
  );
  const duplicates = await Promise.all(
    [1, 2].map(() =>
      call(
        1,
        "POST",
        `/rounds/${membership.round.id}/guesses`,
        { userId: players[1].id, data: "Retry" },
        [200, 201],
      ),
    ),
  );
  assert.equal(duplicates[0].guess.id, duplicates[1].guess.id);
  await call(
    2,
    "POST",
    `/rounds/${membership.round.id}/guesses`,
    { userId: players[2].id, data: "Answer" },
    201,
  );
  await call(0, "DELETE", `/games/${membership.gameId}/participants/${players[3].id}`);
  assert.equal((await call(0, "GET", `/rounds/${membership.round.id}`)).round.phase, "judging");
  const visible = await call(0, "GET", `/rounds/${membership.round.id}/guesses`);
  const scored = await call(0, "POST", `/games/${membership.gameId}/score`, {
    round: {
      id: membership.round.id,
      hostedBy: players[0].id,
      winningGuess: visible.guesses[0].id,
      honorableMentions: [],
    },
  });
  assert.equal(scored.game.status, "finished");
  console.log("PASS membership changes and duplicate submission serialization");
  console.log(
    `COMPLETE: ${regular.gameId} (rounds), ${points.gameId} (points), ${timed.gameId} (timeout)`,
  );
} catch (error) {
  console.error(output.slice(-6000));
  throw error;
} finally {
  backend.kill("SIGTERM");
  await exited;
  await connection.end();
}
