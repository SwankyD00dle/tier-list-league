// Generates the 16 default profile-picture avatars as flat, skribbl.io-style
// SVG faces. Output is deterministic: re-running produces byte-identical files,
// so the committed assets in packages/backend/assets/default-avatars stay in sync
// with this script. The seed script uploads these to Vercel Blob.
//
// Usage:
//   node scripts/generate-default-avatars.mjs [outDir]
// Defaults to packages/backend/assets/default-avatars relative to this file.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const DEFAULT_AVATAR_COUNT = 16;

const DARK = "#1f2430";
const WHITE = "#ffffff";
const TONGUE = "#ff5d73";

// 16 bright, evenly spread background colors (Tailwind 500 family).
const BACKGROUNDS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

function darken(hex, factor = 0.72) {
  const r = Math.round(Number.parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(Number.parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(Number.parseInt(hex.slice(5, 7), 16) * factor);
  const to = (n) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const eyes = {
  dots: () =>
    `<circle cx="46" cy="56" r="7.5" fill="${DARK}"/><circle cx="82" cy="56" r="7.5" fill="${DARK}"/>`,
  happy: () =>
    `<path d="M38 58 Q46 46 54 58" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M74 58 Q82 46 90 58" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>`,
  wide: () =>
    [46, 82]
      .map(
        (cx) =>
          `<circle cx="${cx}" cy="55" r="11" fill="${WHITE}" stroke="${DARK}" stroke-width="4"/>` +
          `<circle cx="${cx}" cy="57" r="5" fill="${DARK}"/>`,
      )
      .join(""),
  sleepy: () =>
    `<path d="M38 54 Q46 61 54 54" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M74 54 Q82 61 90 54" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>`,
  angry: () =>
    `<circle cx="46" cy="58" r="6.5" fill="${DARK}"/><circle cx="82" cy="58" r="6.5" fill="${DARK}"/>` +
    `<path d="M36 44 L54 51" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M92 44 L74 51" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/>`,
  wink: () =>
    `<path d="M38 58 Q46 46 54 58" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="82" cy="56" r="7.5" fill="${DARK}"/>`,
};

const mouths = {
  smile: () =>
    `<path d="M46 82 Q64 100 82 82" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>`,
  grin: () => `<path d="M46 84 Q64 106 82 84 Z" fill="${DARK}"/>`,
  open: () => `<ellipse cx="64" cy="90" rx="11" ry="14" fill="${DARK}"/>`,
  flat: () =>
    `<line x1="50" y1="90" x2="78" y2="90" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>`,
  smirk: () =>
    `<path d="M50 88 Q66 98 80 84" fill="none" stroke="${DARK}" stroke-width="6" stroke-linecap="round"/>`,
  tongue: () =>
    `<path d="M46 84 Q64 106 82 84 Z" fill="${DARK}"/>` +
    `<rect x="58" y="96" width="12" height="10" rx="5" fill="${TONGUE}"/>`,
};

const COMBOS = [
  ["dots", "smile"], ["happy", "grin"], ["wide", "open"], ["dots", "flat"],
  ["sleepy", "smile"], ["angry", "flat"], ["wide", "smile"], ["happy", "open"],
  ["dots", "grin"], ["wink", "smirk"], ["wide", "tongue"], ["sleepy", "flat"],
  ["angry", "open"], ["dots", "smirk"], ["happy", "smile"], ["wide", "grin"],
];

export function buildAvatarSvg(index) {
  const background = BACKGROUNDS[index];
  const border = darken(background);
  const [eyeName, mouthName] = COMBOS[index];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" ` +
    `role="img" aria-label="Default avatar ${index}">\n` +
    `  <rect x="7" y="7" width="114" height="114" rx="30" fill="${background}" stroke="${border}" stroke-width="6"/>\n` +
    `  <g>${eyes[eyeName]()}</g>\n` +
    `  <g>${mouths[mouthName]()}</g>\n` +
    `</svg>\n`
  );
}

async function main() {
  const outDir =
    process.argv[2] ??
    fileURLToPath(new URL("../packages/backend/assets/default-avatars/", import.meta.url));
  await mkdir(outDir, { recursive: true });
  for (let index = 0; index < DEFAULT_AVATAR_COUNT; index += 1) {
    const name = String(index).padStart(2, "0");
    await writeFile(new URL(`${name}.svg`, `file://${outDir.endsWith("/") ? outDir : `${outDir}/`}`), buildAvatarSvg(index));
  }
  console.log(`Wrote ${DEFAULT_AVATAR_COUNT} avatars to ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
