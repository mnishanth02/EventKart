-- ROLLBACK for 0005_empty_bishop.sql
-- Removes SLA/review tracking columns from organizers table.

ALTER TABLE "organizers" DROP CONSTRAINT IF EXISTS "organizers_reviewed_by_users_id_fk";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "rejection_reason";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "reviewed_by";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "reviewed_at";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "submitted_for_review_at";
