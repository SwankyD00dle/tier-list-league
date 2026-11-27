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
    status: text("status").$type<"lobby" | "active" | "finished">().notNull().default("lobby"),
    pointsTarget: integer("points_target"),
    timeoutDays: integer("timeout_days").notNull().default(1),
    winnerIds: uuid("winner_ids").array().notNull().default([]),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    roundCount: integer("round_count").notNull().default(1),
    rounds: uuid("round_ids").array().notNull().default([]),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("round_count_positive", sql`${table.roundCount} > 0`),
    check("game_status_valid", sql`${table.status} IN ('lobby', 'active', 'finished')`),
    check("game_points_target_positive", sql`${table.pointsTarget} > 0`),
    check(
      "game_timeout_days_positive",
      sql`${table.timeoutDays} > 0 AND ${table.timeoutDays} <= 365`,
    ),
  ],
);

type Game = typeof game.$inferSelect;

export type { Game };
export default game;
