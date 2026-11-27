import type { EmptyRelations } from "drizzle-orm";
import { drizzle, type PostgresJsTransaction } from "drizzle-orm/postgres-js";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/tier_list_league";

export const db = drizzle(connectionString);

export type Transaction = PostgresJsTransaction<EmptyRelations>;
