import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import game from "./game";
import tierList from "./tier-list";
import user from "./user";

export interface HonorableMention {
  guessId: string;
  title: string;
}

export interface RoundScoreEntry {
  score: number;
  reason: string;
}

export interface PlayerRoundScore {
  score: number;
  entries: RoundScoreEntry[];
}

export type RoundScoreDeltas = Record<string, PlayerRoundScore>;

const round = pgTable(
  "round",
  {
    id: uuid("round_id").unique().primaryKey(),
    game: uuid("game_id").references(() => game.id),
    roundNumber: integer("round_number").notNull().default(1),
    hostedBy: uuid("hosted_by").references(() => user.id),
    topic: text("topic").notNull(),
    tierList: uuid("tier_list_id").references(() => tierList.id),
    guesses: uuid("guess_ids").array().notNull().default([]),
    winningGuess: uuid("winning_guess_id"),
    honorableMentions: uuid("honorable_mentions_ids").array(),
    honorableMentionDetails: jsonb("honorable_mention_details")
      .$type<HonorableMention[]>()
      .notNull()
      .default([]),
    scoreDeltas: jsonb("score_deltas").$type<RoundScoreDeltas>().notNull().default({}),
    participantTierLists: uuid("participant_tier_lists_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
  },
  (table) => [check("round_count_positive", sql`${table.roundNumber} > 0`)],
);

type Round = typeof round.$inferSelect;

export type { Round };
export default round;
