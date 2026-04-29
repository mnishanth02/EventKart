DROP INDEX IF EXISTS "events_organizer_first_published_paid_idx";
ALTER TABLE "events" DROP COLUMN IF EXISTS "first_published_at";
