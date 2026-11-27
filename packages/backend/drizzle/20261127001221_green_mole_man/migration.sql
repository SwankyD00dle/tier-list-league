ALTER TABLE "round" ADD COLUMN "guessing_duration_ms" bigint;--> statement-breakpoint
ALTER TABLE "round_event" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "round_event" DROP CONSTRAINT "round_event_kind_valid", ADD CONSTRAINT "round_event_kind_valid" CHECK ("kind" IN ('guess_submitted', 'tier_list_submitted', 'deadline_expired'));--> statement-breakpoint
UPDATE "round" r SET guessing_duration_ms = GREATEST(1,
  EXTRACT(EPOCH FROM (r.ends_at - COALESCE(
    (SELECT MIN(e.created_at) FROM round_event e WHERE e.round_id = r.round_id
      AND e.kind = 'tier_list_submitted' AND e.payload->>'role' = 'host'), r.created_at))) * 1000)::bigint
WHERE r.phase = 'guessing' AND r.ends_at IS NOT NULL;
