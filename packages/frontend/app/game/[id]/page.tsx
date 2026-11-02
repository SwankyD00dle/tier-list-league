"use client";

import type {
  GetGameResponse,
  GetRoundResponse,
  ListUsersResponse,
  MeResponse,
} from "@tier-list-league/api-schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { type ApiResult, api, apiUrl, routes } from "@/api/api";
import { Avatar } from "../Avatar";

type Lobby = {
  user: MeResponse;
  game: GetGameResponse["game"];
  users: ListUsersResponse["users"];
  rounds: GetRoundResponse["round"][];
};
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; status: number; message: string }
  | { kind: "ready"; lobby: Lobby };

const buttonClass = "rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white disabled:opacity-50";
const inputClass = "rounded-lg border border-gray-300 px-3 py-2";

export default function GameLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [hostId, setHostId] = useState("");
  const [topic, setTopic] = useState("");

  // A successful mutation or explicit retry must reload the authoritative game state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is the reload trigger.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    async function load() {
      const me = await api.me();
      if (cancelled) return;
      if (!me.ok) {
        setState({ kind: "error", status: me.status, message: me.message });
        return;
      }
      const gameResult = await api.getGame(id);
      if (cancelled) return;
      if (!gameResult.ok) {
        setState({ kind: "error", status: gameResult.status, message: gameResult.message });
        return;
      }
      const game = gameResult.data.game;
      const roundResults = await Promise.all(game.rounds.map((roundId) => api.getRound(roundId)));
      if (cancelled) return;
      const roundFailure = roundResults.find((result) => !result.ok);
      if (roundFailure && !roundFailure.ok) {
        setState({ kind: "error", status: roundFailure.status, message: roundFailure.message });
        return;
      }
      const rounds = roundResults
        .flatMap((result) => (result.ok ? [result.data.round] : []))
        .sort((a, b) => a.roundNumber - b.roundNumber);
      const userIds = [
        ...new Set([
          ...game.participants,
          ...rounds.flatMap((round) => (round.hostedBy ? [round.hostedBy] : [])),
        ]),
      ];
      const usersResult =
        game.createdBy === me.data.id
          ? await api.listUsers()
          : await Promise.all(userIds.map((userId) => api.getUser(userId))).then(
              (results): ApiResult<ListUsersResponse> => {
                const failure = results.find((result) => !result.ok);
                if (failure && !failure.ok) return failure;
                return {
                  ok: true,
                  status: 200,
                  data: {
                    ok: true,
                    users: results.flatMap((result) => (result.ok ? [result.data.user] : [])),
                  },
                };
              },
            );
      if (cancelled) return;
      if (!usersResult.ok) {
        setState({ kind: "error", status: usersResult.status, message: usersResult.message });
        return;
      }
      setState({
        kind: "ready",
        lobby: {
          user: me.data,
          game,
          users: usersResult.data.users,
          rounds,
        },
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, revision]);

  async function mutate(action: () => Promise<ApiResult<unknown>>, onSuccess?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) {
      onSuccess?.();
      setRevision((value) => value + 1);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  function createRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || !hostId) return;
    void mutate(
      () => api.createRound(id, { topic: topic.trim(), hostedBy: hostId, expectedRoundCount: 0 }),
      () => {
        setTopic("");
        setHostId("");
      },
    );
  }

  const lobby = state.kind === "ready" ? state.lobby : null;
  const isAdmin = lobby?.game.createdBy === lobby?.user.id;
  const name = (userId: string) =>
    lobby?.users.find((user) => user.id === userId)?.name ?? "Unknown player";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <Link href="/game" className="text-[#5865F2] hover:underline">
          ← Your games
        </Link>
        {state.kind === "loading" ? <p role="status">Loading game…</p> : null}
        {state.kind === "error" ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
            <h1 className="font-semibold text-xl">
              {state.status === 401
                ? "Log in to view this game"
                : state.status === 403
                  ? "You do not have access to this game"
                  : state.status === 404
                    ? "Game not found"
                    : "We could not load this game"}
            </h1>
            {state.status === 401 ? (
              <a
                href={apiUrl(routes.discordAuth)}
                className="mt-3 inline-block text-[#5865F2] underline"
              >
                Log in with Discord
              </a>
            ) : state.status !== 403 && state.status !== 404 ? (
              <button
                type="button"
                className={`${buttonClass} mt-3`}
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
        {lobby ? (
          <>
            <header>
              <h1 className="font-bold text-3xl">{lobby.game.name}</h1>
              <p className="mt-2 whitespace-pre-wrap text-gray-600">{lobby.game.description}</p>
              <p className="mt-2 text-gray-500 text-sm">
                {lobby.game.roundCount} rounds per player ·{" "}
                {lobby.rounds.length === 0 ? "Not started" : "Started"}
                {isAdmin ? " · You are the admin" : ""}
              </p>
            </header>
            {error ? (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            ) : null}
            <section
              className="rounded-2xl border border-gray-200 bg-white p-6"
              aria-labelledby="members-title"
            >
              <h2 id="members-title" className="font-semibold text-xl">
                Members ({lobby.game.participants.length})
              </h2>
              <ul className="my-4 flex flex-col gap-3">
                {lobby.game.participants.map((userId) => (
                  <li key={userId} className="flex items-center gap-3">
                    <Avatar name={name(userId)} seed={userId} size="sm" />
                    <span className="flex-1">
                      {name(userId)}
                      {userId === lobby.user.id ? " (You)" : ""}
                      {userId === lobby.game.createdBy ? " · Admin" : ""}
                    </span>
                    {isAdmin && userId !== lobby.user.id ? (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          lobby.rounds.some(
                            (round) => round.hostedBy === userId && !round.winningGuess,
                          )
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                        aria-label={`Remove ${name(userId)}`}
                        onClick={() => void mutate(() => api.removeParticipant(id, userId))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {isAdmin ? (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (playerId)
                      void mutate(
                        () => api.addParticipant(id, { userId: playerId }),
                        () => setPlayerId(""),
                      );
                  }}
                >
                  <label className="flex flex-1 flex-col gap-1">
                    Add a registered player
                    <select
                      className={inputClass}
                      value={playerId}
                      onChange={(event) => setPlayerId(event.target.value)}
                      required
                      disabled={busy}
                    >
                      <option value="">Select a player</option>
                      {lobby.users
                        .filter((user) => !lobby.game.participants.includes(user.id))
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="submit" className={buttonClass} disabled={busy || !playerId}>
                    Add player
                  </button>
                </form>
              ) : null}
            </section>
            <section
              className="rounded-2xl border border-gray-200 bg-white p-6"
              aria-labelledby="rounds-title"
            >
              <h2 id="rounds-title" className="font-semibold text-xl">
                Rounds
              </h2>
              {lobby.rounds.length === 0 ? (
                <p className="mt-3 text-gray-600">
                  No rounds yet.{" "}
                  {isAdmin
                    ? "Choose a topic and host to start the game."
                    : "Waiting for the admin to start the game."}
                </p>
              ) : (
                <ol className="mt-4 flex flex-col gap-4">
                  {lobby.rounds.map((round) => (
                    <li key={round.id}>
                      <h3 className="font-medium">
                        Round {round.roundNumber}: {round.topic}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Host: {round.hostedBy ? name(round.hostedBy) : "Unassigned"} ·{" "}
                        {round.winningGuess ? "Finalized" : "In progress"}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              {isAdmin && lobby.rounds.length === 0 ? (
                <form onSubmit={createRound} className="mt-5 flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    Topic
                    <input
                      className={inputClass}
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      maxLength={500}
                      required
                      disabled={busy}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    Host
                    <select
                      className={inputClass}
                      value={hostId}
                      onChange={(event) => setHostId(event.target.value)}
                      required
                      disabled={busy}
                    >
                      <option value="">Select a host</option>
                      {lobby.game.participants.map((userId) => (
                        <option key={userId} value={userId}>
                          {name(userId)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className={`${buttonClass} self-start`}
                    disabled={busy || !topic.trim() || !lobby.game.participants.includes(hostId)}
                  >
                    Start first round
                  </button>
                </form>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
