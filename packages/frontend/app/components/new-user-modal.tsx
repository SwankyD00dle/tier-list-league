"use client";

import { type FormEvent, useState } from "react";

const MAX_USERNAME_LENGTH = 32;

interface NewUserModalProps {
  onSubmit: (username: string) => void;
}

export function NewUserModal({ onSubmit }: NewUserModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = username.trim();
    if (trimmed === "") {
      setError("Username is required");
      return;
    }
    if (trimmed.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer`);
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-user-title"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="new-user-title" className="font-semibold text-gray-900 text-xl">
          Create your user
        </h2>
        <p className="mt-1 text-gray-600 text-sm">Pick a username to get started.</p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
          <label htmlFor="username" className="font-medium text-gray-700 text-sm">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="off"
            maxLength={MAX_USERNAME_LENGTH + 1}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError(null);
            }}
            placeholder="e.g. SwankyD00dle"
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button
            type="submit"
            disabled={username.trim() === ""}
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50"
          >
            Create user
          </button>
        </form>
      </div>
    </div>
  );
}
