DROP TABLE IF EXISTS "event_pricing_tiers";--> statement-breakpoint
ALTER TABLE "event_categories" DROP CONSTRAINT IF EXISTS "event_categories_id_event_id_unique";
