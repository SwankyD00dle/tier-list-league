"use client";

import { type FormEvent, useState } from "react";
import { api } from "@/api/api";

type CreateGameModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

const DEFAULT_ROUND_COUNT = 3;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export function CreateGameModal({ onClose, onCreated }: CreateGameModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roundCount, setRoundCount] = useState(DEFAULT_ROUND_COUNT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && roundCount >= 1 && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await api.createGame({
      name: trimmedName,
      description: description.trim(),
      roundCount,
    });

    if (result.ok) {
      onCreated();
      return;
    }

    setSubmitting(false);
    setError(result.message || "Something went wrong creating the game.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-game-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="create-game-title" className="font-semibold text-gray-900 text-xl">
            Create a game
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700 text-sm">Game name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Friday Night Tier Lists"
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-[#5865F2]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700 text-sm">Description (optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              placeholder="What is this league about?"
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-[#5865F2]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700 text-sm">Rounds per player</span>
            <input
              type="number"
              min={1}
              value={roundCount}
              onChange={(event) => setRoundCount(Math.max(1, Number(event.target.value) || 1))}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-[#5865F2]"
            />
            <span className="text-gray-500 text-xs">
              How many times each player hosts before the game can end.
            </span>
          </label>

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create game"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
