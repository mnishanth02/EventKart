ALTER TABLE "organizers" ADD COLUMN IF NOT EXISTS "slug" varchar(80);--> statement-breakpoint
-- Backfill: normalize businessName ordered by (created_at, id); on collision append -2, -3, ...; on empty use organizer-${id_prefix}
DO $$
DECLARE
	r RECORD;
	base_slug TEXT;
	candidate TEXT;
	suffix INT;
BEGIN
	FOR r IN
		SELECT id, business_name, created_at
		FROM organizers
		WHERE slug IS NULL
		ORDER BY created_at, id
	LOOP
		-- Normalize: lowercase, replace non-alphanumeric runs with hyphens, trim hyphens, cap at 80
		base_slug := lower(r.business_name);
		base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
		base_slug := btrim(base_slug, '-');
		base_slug := left(base_slug, 80);
		base_slug := btrim(base_slug, '-');

		-- If empty, use organizer- prefix with id fragment
		IF base_slug = '' THEN
			base_slug := 'organizer-' || left(replace(r.id::text, '-', ''), 8);
		END IF;

		-- Find unique slug; on collision append -2, -3, ...
		candidate := base_slug;
		suffix := 2;
		WHILE EXISTS (SELECT 1 FROM organizers WHERE slug = candidate AND id != r.id) LOOP
			candidate := left(base_slug, 80 - length('-' || suffix::text)) || '-' || suffix::text;
			suffix := suffix + 1;
		END LOOP;

		UPDATE organizers SET slug = candidate WHERE id = r.id;
	END LOOP;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizers_slug_unique" ON "organizers" ("slug");
