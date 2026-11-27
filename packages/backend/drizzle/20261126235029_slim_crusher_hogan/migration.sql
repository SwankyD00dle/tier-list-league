ALTER TABLE "round" ADD COLUMN "phase" text DEFAULT 'awaiting_host' NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ADD COLUMN "pending_guesser_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_phase_valid" CHECK ("phase" IN ('awaiting_host', 'guessing', 'judging', 'finalized'));--> statement-breakpoint
UPDATE "round" r SET pending_guesser_ids = ARRAY(
  SELECT participant FROM game g, unnest(g.participant_ids) participant
  WHERE g.game_id = r.game_id AND participant IS DISTINCT FROM r.hosted_by
  AND NOT EXISTS (SELECT 1 FROM guess q WHERE q.round_id = r.round_id AND q.user_id = participant)
), phase = CASE WHEN r.winning_guess_id IS NOT NULL THEN 'finalized'
  WHEN r.tier_list_id IS NULL THEN 'awaiting_host' ELSE 'guessing' END;
--> statement-breakpoint
UPDATE "round" SET phase = 'judging'
WHERE phase = 'guessing' AND cardinality(pending_guesser_ids) = 0;
--> statement-breakpoint
UPDATE "round" SET pending_guesser_ids = '{}' WHERE phase <> 'guessing';
