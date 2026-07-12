ALTER TABLE "citizen_reports" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "citizen_reports_client_id_idx" ON "citizen_reports" USING btree ("client_id");