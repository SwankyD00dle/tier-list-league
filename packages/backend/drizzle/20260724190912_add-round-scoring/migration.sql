CREATE TABLE "score_entry" (
	"score_entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guess_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"score" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_entry_score_positive" CHECK ("score" > 0),
	CONSTRAINT "score_entry_kind_valid" CHECK ("kind" IN ('winner', 'honorable_mention'))
);
--> statement-breakpoint
ALTER TABLE "round" ADD COLUMN "honorable_mention_details" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ADD COLUMN "score_deltas" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "score_entry_round_guess_unique" ON "score_entry" ("round_id","guess_id");--> statement-breakpoint
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_game_id_game_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("game_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_round_id_round_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "round"("round_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_user_id_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_guess_id_guess_guess_id_fkey" FOREIGN KEY ("guess_id") REFERENCES "guess"("guess_id") ON DELETE CASCADE;