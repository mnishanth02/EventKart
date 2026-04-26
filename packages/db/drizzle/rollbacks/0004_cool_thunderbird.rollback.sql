-- ROLLBACK for 0004_cool_thunderbird.sql
-- Removes organizer review workflow columns.

ALTER TABLE "organizers" DROP CONSTRAINT IF EXISTS "organizers_reviewed_by_users_id_fk";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "rejection_reason";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "reviewed_by";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "reviewed_at";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "submitted_for_review_at";
