CREATE INDEX IF NOT EXISTS "events_public_listing_order_idx"
	ON "events" ("start_at", "id")
	WHERE "status" = 'published';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_public_listing_active_idx"
	ON "events" ("end_at")
	WHERE "status" = 'published';
