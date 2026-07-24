import { drizzle } from "drizzle-orm/postgres-js";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/tier_list_league";

export const db = drizzle(connectionString);
