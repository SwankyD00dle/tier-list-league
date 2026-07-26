CREATE TABLE "refresh_token" (
	"refresh_token_id" uuid PRIMARY KEY UNIQUE,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_discord_user_id_key" UNIQUE("discord_user_id");--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id");