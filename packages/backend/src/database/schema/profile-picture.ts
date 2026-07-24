import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import game from "./game";
import user from "./user";

const profilePicture = pgTable("profile_picture", {
  id: uuid("profile_picture_id").unique().primaryKey(),
  url: text("url").notNull(),
  user: uuid("user_id").references(() => user.id),
  game: uuid("game_id").references(() => game.id),
  createdBy: uuid("created_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

type ProfilePicture = typeof profilePicture.$inferSelect;

export type { ProfilePicture };
export default profilePicture;
