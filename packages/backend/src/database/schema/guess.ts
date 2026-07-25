import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import round from "./round";
import user from "./user";

const guess = pgTable(
  "guess",
  {
    id: uuid("guess_id").unique().primaryKey(),
    round: uuid("round_id").references(() => round.id),
    data: text("guess_data").notNull(),
    createdBy: uuid("user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("guess_data_not_empty", sql`${table.data} != ''`),
    uniqueIndex("guess_round_user_unique").on(table.round, table.createdBy),
  ],
);

type Guess = typeof guess.$inferSelect;

export type { Guess };
export default guess;
