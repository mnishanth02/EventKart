ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: events currently published/completed get firstPublishedAt = published_at (best approximation)
UPDATE "events"
SET "first_published_at" = "published_at"
WHERE "status" IN ('published', 'completed')
	AND "first_published_at" IS NULL
	AND "published_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_organizer_first_published_paid_idx"
	ON "events" ("organizer_id", "first_published_at")
	WHERE "first_published_at" IS NOT NULL AND "is_paid" = true;
