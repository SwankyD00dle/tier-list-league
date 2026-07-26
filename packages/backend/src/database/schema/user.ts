import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const user = pgTable("user", {
  id: uuid("user_id").unique().primaryKey(),
  name: text("name").notNull(),
  discordUserId: text("discord_user_id").notNull().unique(),
  activeGames: uuid("active_games").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

type User = typeof user.$inferSelect;

export type { User };
export default user;
