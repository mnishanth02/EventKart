-- Rollback for 0020_organizers_deleted_at.sql
-- Reverse: drop partial indexes, recreate full unique indexes, drop deleted_at column.
--
-- ⚠️ DATA-DEPENDENT ROLLBACK ⚠️
-- If any soft-deleted organizers exist (deleted_at IS NOT NULL), recreating full
-- unique indexes will fail if duplicate user_id/slug/razorpay_account_id exist
-- across active + deleted rows. Hard-delete or reassign those rows first.

DROP INDEX IF EXISTS "organizers_deleted_at_idx";--> statement-breakpoint

-- Drop partial unique indexes
DROP INDEX IF EXISTS "organizers_user_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "organizers_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "organizers_razorpay_account_id_unique";--> statement-breakpoint

-- Recreate original full unique indexes
CREATE UNIQUE INDEX "organizers_user_id_unique" ON "organizers" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizers_slug_unique" ON "organizers" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "organizers_razorpay_account_id_unique" ON "organizers" ("razorpay_account_id");--> statement-breakpoint

-- Drop the deleted_at column
ALTER TABLE "organizers" DROP COLUMN "deleted_at";
