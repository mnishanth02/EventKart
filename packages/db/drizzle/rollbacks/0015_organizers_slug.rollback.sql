DROP INDEX IF EXISTS "organizers_slug_unique";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "slug";
