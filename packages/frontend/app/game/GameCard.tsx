import type { ListGamesResponse, ListUsersResponse } from "@tier-list-league/api-schema";
import { Avatar } from "./Avatar";

type Game = ListGamesResponse["games"][number];
type UserSummary = ListUsersResponse["users"][number];

type GameCardProps = {
  game: Game;
  currentUserId: string;
  usersById: Map<string, UserSummary>;
  /**
   * Highlights the card when it is the current user's turn to act. Wiring this to
   * real turn state needs per-round data (host + submission status), which is not
   * available from the games list endpoint yet, so it stays off for now.
   */
  needsAction?: boolean;
};

const MAX_VISIBLE_AVATARS = 5;

export function GameCard({ game, currentUserId, usersById, needsAction = false }: GameCardProps) {
  const isAdmin = game.createdBy === currentUserId;
  const roundsPlayed = game.rounds.length;
  const status = roundsPlayed === 0 ? "Not started" : "In progress";

  const visibleParticipants = game.participants.slice(0, MAX_VISIBLE_AVATARS);
  const hiddenCount = game.participants.length - visibleParticipants.length;

  function displayName(userId: string): string {
    if (userId === currentUserId) {
      return "You";
    }
    return usersById.get(userId)?.name ?? "Unknown player";
  }

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
        needsAction ? "border-[#5865F2] ring-2 ring-[#5865F2]/30" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-gray-900 text-lg">{game.name}</h2>
          {game.description ? (
            <p className="mt-1 line-clamp-2 text-gray-500 text-sm">{game.description}</p>
          ) : null}
        </div>
        {isAdmin ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800 text-xs">
            Admin
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-gray-600 text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            roundsPlayed === 0 ? "bg-gray-300" : "bg-emerald-500"
          }`}
        />
        <span>{status}</span>
        <span aria-hidden="true">·</span>
        <span>
          {roundsPlayed} {roundsPlayed === 1 ? "round" : "rounds"} played
        </span>
      </div>

      {needsAction ? (
        <p className="font-medium text-[#5865F2] text-sm">Your turn is pending</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {visibleParticipants.map((userId) => (
              <Avatar key={userId} name={displayName(userId)} seed={userId} size="sm" />
            ))}
          </div>
          {hiddenCount > 0 ? <span className="ml-2 text-gray-500 text-xs">+{hiddenCount}</span> : null}
        </div>
        <span className="text-gray-500 text-xs">
          {game.participants.length} {game.participants.length === 1 ? "player" : "players"}
        </span>
      </div>
    </article>
  );
}
