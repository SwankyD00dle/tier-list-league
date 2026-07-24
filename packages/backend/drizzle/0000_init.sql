CREATE TABLE "game" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"participant_ids" uuid[] DEFAULT '{}' NOT NULL,
	"round_count" integer DEFAULT 1 NOT NULL,
	"round_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_game_id_unique" UNIQUE("game_id"),
	CONSTRAINT "round_count_positive" CHECK ("game"."round_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "guess" (
	"guess_id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid,
	"guess_data" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guess_guess_id_unique" UNIQUE("guess_id"),
	CONSTRAINT "guess_data_not_empty" CHECK ("guess"."guess_data" != '')
);
--> statement-breakpoint
CREATE TABLE "profile_picture" (
	"profile_picture_id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"user_id" uuid,
	"game_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_picture_profile_picture_id_unique" UNIQUE("profile_picture_id")
);
--> statement-breakpoint
CREATE TABLE "round" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid,
	"round_number" integer DEFAULT 1 NOT NULL,
	"hosted_by" uuid,
	"topic" text NOT NULL,
	"tier_list_id" uuid,
	"guess_ids" uuid[] DEFAULT '{}' NOT NULL,
	"winning_guess_id" uuid,
	"honorable_mentions_ids" uuid[],
	"participant_tier_lists_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	CONSTRAINT "round_round_id_unique" UNIQUE("round_id"),
	CONSTRAINT "round_count_positive" CHECK ("round"."round_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "tier_list" (
	"tier_list_id" uuid PRIMARY KEY NOT NULL,
	"created_by" uuid,
	"tier_list_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_list_tier_list_id_unique" UNIQUE("tier_list_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"active_games" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_created_by_user_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guess" ADD CONSTRAINT "guess_round_id_round_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."round"("round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guess" ADD CONSTRAINT "guess_user_id_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_picture" ADD CONSTRAINT "profile_picture_user_id_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_picture" ADD CONSTRAINT "profile_picture_game_id_game_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_picture" ADD CONSTRAINT "profile_picture_created_by_user_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_game_id_game_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_hosted_by_user_user_id_fk" FOREIGN KEY ("hosted_by") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_tier_list_id_tier_list_tier_list_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_list"("tier_list_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_list" ADD CONSTRAINT "tier_list_created_by_user_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("user_id") ON DELETE no action ON UPDATE no action;