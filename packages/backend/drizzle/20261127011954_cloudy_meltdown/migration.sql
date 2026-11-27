ALTER TABLE "game" ADD COLUMN "status" text DEFAULT 'lobby' NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "points_target" integer;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "timeout_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "winner_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_status_valid" CHECK ("status" IN ('lobby', 'active', 'finished'));--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_points_target_positive" CHECK ("points_target" > 0);--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_timeout_days_positive" CHECK ("timeout_days" > 0 AND "timeout_days" <= 365);--> statement-breakpoint
ALTER TABLE "round_event" DROP CONSTRAINT "round_event_kind_valid", ADD CONSTRAINT "round_event_kind_valid" CHECK ("kind" IN ('guess_submitted', 'tier_list_submitted', 'deadline_expired', 'round_finalized'));--> statement-breakpoint
UPDATE "game" SET status = 'active' WHERE cardinality(round_ids) > 0;
--> statement-breakpoint
UPDATE "round" SET guessing_duration_ms = 86400000 WHERE guessing_duration_ms IS NULL AND phase = 'awaiting_host';
