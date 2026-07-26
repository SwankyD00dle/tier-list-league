import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import user from "./user";

const refreshToken = pgTable("refresh_token", {
  id: uuid("refresh_token_id").unique().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

type RefreshToken = typeof refreshToken.$inferSelect;

export type { RefreshToken };
export default refreshToken;
