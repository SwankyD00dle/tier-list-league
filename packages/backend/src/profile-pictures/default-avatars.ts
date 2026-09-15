import { and, asc, isNull } from "drizzle-orm";
import type { db } from "../database/client";
import profilePicture, { type ProfilePicture } from "../database/schema/profile-picture";

/**
 * How many default avatars are seeded. Must match the number of assets in
 * `assets/default-avatars` and the `DEFAULT_AVATAR_COUNT` in the generator
 * (`scripts/generate-default-avatars.mjs`).
 */
export const DEFAULT_AVATAR_COUNT = 16;

/**
 * Turns a UUID into a stable, non-negative integer by folding its hex digits.
 * Deterministic across runs and processes, so a user always maps to the same
 * default avatar until they set their own picture.
 */
export function uuidToInt(uuid: string): number {
  const hex = uuid.replace(/[^0-9a-fA-F]/g, "");
  let hash = 0;
  for (let index = 0; index < hex.length; index += 1) {
    const digit = Number.parseInt(hex[index] ?? "0", 16);
    // Keep the running value inside 31 bits so it stays a safe positive integer.
    hash = (hash * 16 + digit) % 0x7fffffff;
  }
  return hash;
}

/**
 * Deterministic slot in `[0, count)` for a user id — the "modulo on their uuid"
 * default-avatar assignment.
 */
export function defaultAvatarIndex(userId: string, count: number = DEFAULT_AVATAR_COUNT): number {
  if (count <= 0) {
    return 0;
  }
  return uuidToInt(userId) % count;
}

/**
 * Loads the seeded default avatars. Defaults are the `profile_picture` rows with
 * no owner, game, or creator; they are ordered by `url`, whose path carries a
 * zero-padded slot (`default-avatars/00.svg`), giving a stable 0..N order.
 */
export function listDefaultProfilePictures(database: typeof db) {
  return database
    .select()
    .from(profilePicture)
    .where(
      and(
        isNull(profilePicture.user),
        isNull(profilePicture.game),
        isNull(profilePicture.createdBy),
      ),
    )
    .orderBy(asc(profilePicture.url));
}

/**
 * Picks the default avatar for a user from an already-loaded default list.
 * Returns `null` when no defaults have been seeded yet.
 */
export function resolveDefaultProfilePicture(
  defaults: ProfilePicture[],
  userId: string,
): ProfilePicture | null {
  if (defaults.length === 0) {
    return null;
  }
  return defaults[defaultAvatarIndex(userId, defaults.length)] ?? null;
}
