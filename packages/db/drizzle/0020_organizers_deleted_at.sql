-- Migration 0020: Add deleted_at to organizers for soft-delete support
-- Replace full unique indexes with partial indexes (WHERE deleted_at IS NULL)
-- Safe pattern: create new partial indexes FIRST, then drop old full indexes.

ALTER TABLE "organizers" ADD COLUMN "deleted_at" TIMESTAMPTZ;--> statement-breakpoint

-- Create new partial unique indexes (safe: no name conflict with existing indexes)
CREATE UNIQUE INDEX "organizers_user_id_partial_unique" ON "organizers" ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizers_slug_partial_unique" ON "organizers" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizers_razorpay_account_id_partial_unique" ON "organizers" ("razorpay_account_id") WHERE deleted_at IS NULL AND razorpay_account_id IS NOT NULL;--> statement-breakpoint

-- Drop old full unique indexes (now redundant)
DROP INDEX "organizers_user_id_unique";--> statement-breakpoint
DROP INDEX "organizers_slug_unique";--> statement-breakpoint
DROP INDEX "organizers_razorpay_account_id_unique";--> statement-breakpoint

-- Rename partial indexes to canonical names
ALTER INDEX "organizers_user_id_partial_unique" RENAME TO "organizers_user_id_unique";--> statement-breakpoint
ALTER INDEX "organizers_slug_partial_unique" RENAME TO "organizers_slug_unique";--> statement-breakpoint
ALTER INDEX "organizers_razorpay_account_id_partial_unique" RENAME TO "organizers_razorpay_account_id_unique";--> statement-breakpoint

-- Index for future KYC cleanup query (I-7.3.7)
CREATE INDEX "organizers_deleted_at_idx" ON "organizers" ("deleted_at") WHERE deleted_at IS NOT NULL;
