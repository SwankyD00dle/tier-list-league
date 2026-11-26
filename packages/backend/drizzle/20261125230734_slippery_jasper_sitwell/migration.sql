CREATE TABLE "round_event" (
	"round_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"round_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_event_kind_valid" CHECK ("kind" IN ('guess_submitted', 'tier_list_submitted')),
	CONSTRAINT "round_event_payload_kind_matches" CHECK ("payload"->>'kind' IS NOT NULL AND "payload"->>'kind' = "kind")
);
--> statement-breakpoint
CREATE INDEX "round_event_round_created_idx" ON "round_event" ("round_id","created_at","round_event_id");--> statement-breakpoint
ALTER TABLE "round_event" ADD CONSTRAINT "round_event_round_id_round_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "round"("round_id");--> statement-breakpoint
ALTER TABLE "round_event" ADD CONSTRAINT "round_event_actor_id_user_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("user_id");