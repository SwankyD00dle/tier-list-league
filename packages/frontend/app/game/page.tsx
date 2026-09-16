"use client";

import type {
  ListGamesResponse,
  ListUsersResponse,
  MeResponse,
} from "@tier-list-league/api-schema";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { api, apiUrl, routes } from "@/api/api";
import { CreateGameModal } from "./CreateGameModal";
import { GameCard } from "./GameCard";

type Game = ListGamesResponse["games"][number];
type UserSummary = ListUsersResponse["users"][number];
type LoadState = "loading" | "ready" | "error";

export default function GamesPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [usersById, setUsersById] = useState<Map<string, UserSummary>>(new Map());
  const [state, setState] = useState<LoadState>("loading");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const me = await api.me();
    if (!me.ok) {
      setUser(null);
      setState("ready");
      return;
    }
    setUser(me.data);

    const [gamesResult, usersResult] = await Promise.all([api.listGames(), api.listUsers()]);

    if (usersResult.ok) {
      setUsersById(new Map(usersResult.data.users.map((entry) => [entry.id, entry] as const)));
    }

    if (!gamesResult.ok) {
      setState("error");
      return;
    }

    // The list endpoint returns every game, so narrow to the ones this user belongs to.
    const mine = gamesResult.data.games.filter(
      (game) => game.createdBy === me.data.id || game.participants.includes(me.data.id),
    );
    mine.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    setGames(mine);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">
        <p className="text-gray-600 text-lg">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-gray-900">
        <h1 className="font-bold text-3xl tracking-tight">Your games</h1>
        <p className="text-gray-600">Log in with Discord to see your games.</p>
        <a
          href={apiUrl(routes.discordAuth)}
          className="rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white"
        >
          Log In with Discord
        </a>
      </main>
    );
  }

  let content: ReactNode;
  if (state === "error") {
    content = (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">We could not load your games.</p>
        <button
          type="button"
          onClick={() => {
            setState("loading");
            void load();
          }}
          className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700"
        >
          Try again
        </button>
      </div>
    );
  } else if (games.length === 0) {
    content = (
      <div className="rounded-2xl border border-gray-200 border-dashed bg-white p-10 text-center">
        <h2 className="font-semibold text-gray-900 text-lg">No games yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-gray-500 text-sm">
          Create your first game to start building tier lists with your friends.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-4 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white"
        >
          Create game
        </button>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} currentUserId={user.id} usersById={usersById} />
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Your games</h1>
            <p className="mt-1 text-gray-600 text-sm">
              {games.length === 0
                ? "You are not in any games yet."
                : `You are in ${games.length} ${games.length === 1 ? "game" : "games"}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white transition-opacity hover:opacity-90"
          >
            Create game
          </button>
        </header>

        {content}
      </div>

      {creating ? (
        <CreateGameModal
          createdBy={user.id}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setState("loading");
            void load();
          }}
        />
      ) : null}
    </main>
  );
}
