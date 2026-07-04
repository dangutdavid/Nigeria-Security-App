CREATE TABLE "agencies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"full_name" text NOT NULL,
	"primary_color" text NOT NULL,
	"secondary_color" text NOT NULL,
	"badge_prefix" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"actor_user_id" text,
	"actor_agency" text,
	"target_id" text,
	"report_reference" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citizen_report_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"uri" text NOT NULL,
	"storage_key" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"checksum" text,
	"uploaded_by" text,
	"metadata" jsonb,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citizen_report_evidence" ADD CONSTRAINT "citizen_report_evidence_report_id_citizen_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."citizen_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_type_created_idx" ON "audit_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_agency_idx" ON "audit_events" USING btree ("actor_agency");--> statement-breakpoint
CREATE INDEX "citizen_report_evidence_report_idx" ON "citizen_report_evidence" USING btree ("report_id");