import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import round from "./round";
import type { TierListEntry } from "./tier-list";
import user from "./user";

export type RoundEventKind = "guess_submitted" | "tier_list_submitted" | "deadline_expired";
type SubmissionPayload = {
  submissionId: string;
  operation: "created" | "updated";
} & (
  | { kind: "guess_submitted"; data: string }
  | { kind: "tier_list_submitted"; role: "host" | "participant"; data: TierListEntry }
);

export type RoundEventPayload =
  | SubmissionPayload
  | {
      kind: "deadline_expired";
      deadline: string;
      outcome: "judging" | "host_changed";
      previousHost: string | null;
      nextHost: string | null;
    };

const roundEvent = pgTable(
  "round_event",
  {
    id: uuid("round_event_id").defaultRandom().primaryKey(),
    round: uuid("round_id")
      .notNull()
      .references(() => round.id),
    actor: uuid("actor_id").references(() => user.id),
    kind: text("kind").$type<RoundEventKind>().notNull(),
    payload: jsonb("payload").$type<RoundEventPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("round_event_round_created_idx").on(table.round, table.createdAt, table.id),
    check(
      "round_event_kind_valid",
      sql`${table.kind} IN ('guess_submitted', 'tier_list_submitted', 'deadline_expired')`,
    ),
    check(
      "round_event_payload_kind_matches",
      sql`${table.payload}->>'kind' IS NOT NULL AND ${table.payload}->>'kind' = ${table.kind}`,
    ),
  ],
);

export type RoundEvent = typeof roundEvent.$inferSelect;
export default roundEvent;
