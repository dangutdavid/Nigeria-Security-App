CREATE TABLE "auth_mfa" (
	"user_id" text PRIMARY KEY NOT NULL,
	"totp_secret_enc" text,
	"totp_pending_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_last_step" integer,
	"sms_phone_enc" text,
	"sms_pending_phone_enc" text,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enrolled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Row-level security: a user manages only their own second factor; login-time
-- verification runs as 'system' (pre-session). Admins may reset a user's MFA.
ALTER TABLE "auth_mfa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_mfa" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_mfa_self ON public.auth_mfa FOR ALL
  USING (app.is_admin() OR user_id = app.caller_user_id())
  WITH CHECK (app.is_admin() OR user_id = app.caller_user_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_mfa TO nsa_app;
