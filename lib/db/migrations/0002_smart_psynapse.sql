CREATE TABLE "revoked_tokens" (
	"jti" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_users" ADD COLUMN "email" text;