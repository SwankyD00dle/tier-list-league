import { and, eq, lte } from "drizzle-orm";
import game from "../../../database/schema/game";
import round, { type Round } from "../../../database/schema/round";
import roundEvent from "../../../database/schema/round-event";
import type { BaseHandlerConfig } from "../../handler";

type Transaction = Parameters<Parameters<BaseHandlerConfig["db"]["transaction"]>[0]>[0];

// The caller holds the round lock until the surrounding transaction commits.
export async function advanceExpiredRound(
  tx: Transaction,
  current: Round,
  participants: string[],
  now = new Date(),
): Promise<Round> {
  if (current.phase !== "guessing" || !current.endsAt || current.endsAt > now) return current;
  const hasGuesses = current.guesses.length > 0;
  const hostIndex = participants.indexOf(current.hostedBy ?? "");
  const orderedPlayers = [
    ...participants.slice(hostIndex + 1),
    ...participants.slice(0, hostIndex + 1),
  ];
  const nextHost = orderedPlayers.find((id) => id !== current.hostedBy) ?? null;
  const changes = hasGuesses
    ? { phase: "judging" as const, pendingGuessers: [], updatedAt: now }
    : {
        phase: "awaiting_host" as const,
        pendingGuessers: [],
        hostedBy: nextHost,
        tierList: null,
        participantTierLists: [],
        endsAt: null,
        updatedAt: now,
      };
  await tx.update(round).set(changes).where(eq(round.id, current.id));
  await tx.insert(roundEvent).values({
    round: current.id,
    actor: null,
    kind: "deadline_expired",
    payload: {
      kind: "deadline_expired",
      deadline: current.endsAt.toISOString(),
      outcome: hasGuesses ? "judging" : "host_changed",
      previousHost: current.hostedBy,
      nextHost: hasGuesses ? current.hostedBy : nextHost,
    },
  });
  return { ...current, ...changes };
}

export async function processRoundDeadline(database: BaseHandlerConfig["db"], roundId: string) {
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(round)
      .where(eq(round.id, roundId))
      .limit(1)
      .for("update");
    if (
      current?.phase !== "guessing" ||
      !current.endsAt ||
      current.endsAt > new Date() ||
      !current.game
    )
      return current;
    const [parent] = await tx
      .select({ participants: game.participants })
      .from(game)
      .where(eq(game.id, current.game))
      .limit(1);
    return advanceExpiredRound(tx, current, parent?.participants ?? []);
  });
}

export async function sweepRoundDeadlines(config: BaseHandlerConfig) {
  const expired = await config.db
    .select({ id: round.id })
    .from(round)
    .where(and(eq(round.phase, "guessing"), lte(round.endsAt, new Date())));
  for (const { id } of expired) {
    try {
      await processRoundDeadline(config.db, id);
    } catch (error) {
      config.log.error({ roundId: id, error: String(error) }, "Round deadline failed");
    }
  }
}

export function startDeadlineWorker(config: BaseHandlerConfig) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function run() {
    try {
      await sweepRoundDeadlines(config);
    } catch (error) {
      config.log.error({ error: String(error) }, "Deadline sweep failed");
    }
    if (!stopped) {
      timer = setTimeout(run, 30_000);
      timer.unref();
    }
  }
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
