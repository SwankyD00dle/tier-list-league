import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import game from "./schema/game";
import guess from "./schema/guess";
import profilePicture from "./schema/profile-picture";
import round from "./schema/round";
import tierList from "./schema/tier-list";
import user from "./schema/user";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/tier_list_league";

const client = postgres(connectionString);

export const db = drizzle(client, {
  schema: { user, game, round, guess, tierList, profilePicture },
});
