"use client";

import type { MeResponse } from "@tier-list-league/api-schema";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, routes } from "@/api/api";

export default function Home() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const result = await api.me();
      if (!cancelled) {
        setUser(result.ok ? result.data : null);
        setReady(true);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setLoggingOut(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-gray-900">
      <h1 className="font-bold text-4xl tracking-tight">Tier List League</h1>
      {!ready ? (
        <p className="text-gray-600 text-lg">Loading…</p>
      ) : user ? (
        <>
          <p className="text-gray-600 text-lg">Welcome, {user.name}.</p>
          <div className="flex items-center gap-3">
            <Link href="/game" className="rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white">
              Go to my games
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-900 transition-opacity disabled:opacity-50"
            >
              Log out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-600 text-lg">Log in with Discord to get started.</p>
          <a
            href={routes.discordAuth}
            className="rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white"
          >
            Log In with Discord
          </a>
        </>
      )}
    </main>
  );
}
