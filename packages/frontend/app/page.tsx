"use client";

import { useEffect, useState } from "react";
import { NewUserModal } from "./components/new-user-modal";

const USERNAME_STORAGE_KEY = "tier-list-league:username";

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUsername(window.localStorage.getItem(USERNAME_STORAGE_KEY));
    setReady(true);
  }, []);

  function handleCreateUser(name: string) {
    window.localStorage.setItem(USERNAME_STORAGE_KEY, name);
    setUsername(name);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-gray-900">
      <h1 className="font-bold text-4xl tracking-tight">Tier List League</h1>
      {username ? (
        <p className="text-gray-600 text-lg">Welcome, {username}.</p>
      ) : (
        <p className="text-gray-600 text-lg">Create a user to get started.</p>
      )}
      {ready && username === null ? <NewUserModal onSubmit={handleCreateUser} /> : null}
    </main>
  );
}
