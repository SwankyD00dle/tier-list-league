import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import game from "./game";
import guess from "./guess";
import round from "./round";
import user from "./user";

export type ScoreEntryKind = "winner" | "honorable_mention";

const scoreEntry = pgTable(
  "score_entry",
  {
    id: uuid("score_entry_id").defaultRandom().primaryKey(),
    game: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    round: uuid("round_id")
      .notNull()
      .references(() => round.id, { onDelete: "cascade" }),
    user: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    guess: uuid("guess_id")
      .notNull()
      .references(() => guess.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ScoreEntryKind>().notNull(),
    score: integer("score").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("score_entry_score_positive", sql`${table.score} > 0`),
    check("score_entry_kind_valid", sql`${table.kind} IN ('winner', 'honorable_mention')`),
    uniqueIndex("score_entry_round_guess_unique").on(table.round, table.guess),
  ],
);

type ScoreEntry = typeof scoreEntry.$inferSelect;

export type { ScoreEntry };
export default scoreEntry;
