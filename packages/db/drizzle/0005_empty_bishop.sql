ALTER TABLE "organizers" ADD COLUMN "submitted_for_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;