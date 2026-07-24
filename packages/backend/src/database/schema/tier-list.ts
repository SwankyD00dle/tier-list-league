import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import user from "./user";

const tierList = pgTable("tier_list", {
  id: uuid("tier_list_id").unique().primaryKey(),
  createdBy: uuid("created_by").references(() => user.id),
  data: jsonb("tier_list_data").notNull().$type<TierListEntry>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

type TierList = typeof tierList.$inferSelect;

type Tier = "SS" | "S" | "A" | "B" | "C" | "D" | "E" | "F";
type TierListEntry = {
  [key in Tier]: string[]; // Each tier has an array of user ids
};

export type { Tier, TierList, TierListEntry };
export default tierList;
