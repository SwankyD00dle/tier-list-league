import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import user from "./user";

const game = pgTable(
  "game",
  {
    id: uuid("game_id").unique().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    participants: uuid("participant_ids").array().notNull().default([]),
    roundCount: integer("round_count").notNull().default(1),
    rounds: uuid("round_ids").array().notNull().default([]),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("round_count_positive", sql`${table.roundCount} > 0`)],
);

type Game = typeof game.$inferSelect;

export type { Game };
export default game;
