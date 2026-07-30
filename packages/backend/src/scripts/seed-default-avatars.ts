import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { and, isNull } from "drizzle-orm";
import { db } from "../database/client";
import profilePicture from "../database/schema/profile-picture";
import { DEFAULT_AVATAR_COUNT } from "../profile-pictures/default-avatars";

/**
 * Uploads the default avatar assets to Vercel Blob and (re)seeds the matching
 * `profile_picture` rows. Idempotent: assets are uploaded to deterministic
 * pathnames (`default-avatars/00.svg`) and the default rows are replaced
 * wholesale, so re-running refreshes URLs without creating duplicates.
 *
 * Requires `BLOB_READ_WRITE_TOKEN` (see `.env.example`) and `DATABASE_URL`.
 * Run with: `npm run seed:default-avatars --workspace @tier-list-league/backend`.
 */

const ASSET_DIR = fileURLToPath(new URL("../../assets/default-avatars/", import.meta.url));
const BLOB_PREFIX = "default-avatars";

async function seedDefaultAvatars(): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required to upload default avatars. See packages/backend/.env.example.",
    );
  }

  const urls: string[] = [];
  for (let index = 0; index < DEFAULT_AVATAR_COUNT; index += 1) {
    const name = `${String(index).padStart(2, "0")}.svg`;
    const svg = await readFile(join(ASSET_DIR, name), "utf8");
    const blob = await put(`${BLOB_PREFIX}/${name}`, svg, {
      access: "public",
      contentType: "image/svg+xml",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });
    urls.push(blob.url);
    console.log(`Uploaded ${name} -> ${blob.url}`);
  }

  await db.transaction(async (tx) => {
    // Default avatars are the profile_picture rows with no owner, game, or
    // creator. Clear and re-insert them so the seed is safe to run repeatedly.
    await tx
      .delete(profilePicture)
      .where(
        and(
          isNull(profilePicture.user),
          isNull(profilePicture.game),
          isNull(profilePicture.createdBy),
        ),
      );
    await tx.insert(profilePicture).values(
      urls.map((url) => ({
        id: randomUUID(),
        url,
        user: null,
        game: null,
        createdBy: null,
      })),
    );
  });

  console.log(`Seeded ${urls.length} default profile pictures.`);
}

seedDefaultAvatars()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
