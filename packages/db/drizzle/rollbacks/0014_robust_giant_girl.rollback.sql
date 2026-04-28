ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_form_schema_version_check";
ALTER TABLE "events" DROP COLUMN IF EXISTS "form_schema_version";
ALTER TABLE "events" DROP COLUMN IF EXISTS "form_schema";
