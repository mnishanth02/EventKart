CREATE TYPE "public"."razorpay_account_status" AS ENUM('not_started', 'pending', 'active', 'needs_action', 'suspended', 'failed');--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_account_status" "razorpay_account_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_raw_status" varchar(100);--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_last_error" text;--> statement-breakpoint
ALTER TABLE "organizers" ADD COLUMN "razorpay_last_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "organizers_razorpay_account_id_unique" ON "organizers" USING btree ("razorpay_account_id");