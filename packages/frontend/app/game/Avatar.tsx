type AvatarProps = {
  /** Display name used for the tooltip and initials fallback. */
  name: string;
  /** Stable seed (e.g. a user id) so the color stays consistent across renders. */
  seed?: string;
  size?: "sm" | "md";
};

// Full class strings so Tailwind can statically detect them.
const PALETTE = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];
const FALLBACK_COLOR = "bg-slate-500";

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
} as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length <= 1) {
    return first.slice(0, 2).toUpperCase() || "?";
  }
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function getColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? FALLBACK_COLOR;
}

/**
 * Placeholder avatar rendered from a player's initials. Once the backend exposes
 * `GET /profile-picture`, swap the colored circle for the stored image url.
 */
export function Avatar({ name, seed, size = "md" }: AvatarProps) {
  return (
    <span
      title={name}
      className={`inline-flex ${SIZES[size]} items-center justify-center rounded-full ${getColor(
        seed ?? name,
      )} font-semibold text-white ring-2 ring-white`}
    >
      {getInitials(name)}
    </span>
  );
}
