"use client";

import { useEffect, useState } from "react";

interface AuthUser {
  id: string;
  name: string;
  discordUserId: string;
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
          }
          return;
        }
        const data: unknown = await response.json();
        if (
          typeof data === "object" &&
          data !== null &&
          "ok" in data &&
          data.ok === true &&
          "id" in data &&
          typeof data.id === "string" &&
          "name" in data &&
          typeof data.name === "string" &&
          "discordUserId" in data &&
          typeof data.discordUserId === "string"
        ) {
          if (!cancelled) {
            setUser({
              id: data.id,
              name: data.name,
              discordUserId: data.discordUserId,
            });
          }
          return;
        }
        if (!cancelled) {
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
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
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-900 transition-opacity disabled:opacity-50"
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-600 text-lg">Log in with Discord to get started.</p>
          <a
            href="/api/auth/discord"
            className="rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white"
          >
            Log In with Discord
          </a>
        </>
      )}
    </main>
  );
}
