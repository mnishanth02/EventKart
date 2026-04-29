ALTER TABLE "event_categories" DROP CONSTRAINT IF EXISTS "event_categories_spots_remaining_lte_total_check";
ALTER TABLE "event_categories" DROP CONSTRAINT IF EXISTS "event_categories_spots_remaining_non_negative_check";
ALTER TABLE "event_categories" DROP CONSTRAINT IF EXISTS "event_categories_spots_total_positive_check";
ALTER TABLE "event_categories" DROP COLUMN IF EXISTS "spots_remaining";
ALTER TABLE "event_categories" DROP COLUMN IF EXISTS "spots_total";
