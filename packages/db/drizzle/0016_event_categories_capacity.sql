-- Step 1: Add nullable columns
ALTER TABLE "event_categories" ADD COLUMN IF NOT EXISTS "spots_total" integer;--> statement-breakpoint
ALTER TABLE "event_categories" ADD COLUMN IF NOT EXISTS "spots_remaining" integer;--> statement-breakpoint
-- Step 2: Backfill existing rows with default capacity
UPDATE "event_categories" SET "spots_total" = 100 WHERE "spots_total" IS NULL;--> statement-breakpoint
UPDATE "event_categories" SET "spots_remaining" = 100 WHERE "spots_remaining" IS NULL;--> statement-breakpoint
-- Step 3: Set NOT NULL with defaults for new rows
ALTER TABLE "event_categories" ALTER COLUMN "spots_total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_categories" ALTER COLUMN "spots_total" SET DEFAULT 100;--> statement-breakpoint
ALTER TABLE "event_categories" ALTER COLUMN "spots_remaining" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_categories" ALTER COLUMN "spots_remaining" SET DEFAULT 100;--> statement-breakpoint
-- Step 4: Add CHECK constraints (idempotent)
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'event_categories_spots_total_positive_check'
			AND conrelid = 'event_categories'::regclass
	) THEN
		ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_spots_total_positive_check" CHECK ("spots_total" > 0);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'event_categories_spots_remaining_non_negative_check'
			AND conrelid = 'event_categories'::regclass
	) THEN
		ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_spots_remaining_non_negative_check" CHECK ("spots_remaining" >= 0);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'event_categories_spots_remaining_lte_total_check'
			AND conrelid = 'event_categories'::regclass
	) THEN
		ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_spots_remaining_lte_total_check" CHECK ("spots_remaining" <= "spots_total");
	END IF;
END $$;
