-- ROLLBACK for 0008_ambitious_raza.sql
-- Removes I-1.2.1 event creation foundation columns, V1 checks, and enums.

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_paid_check";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_timezone_check";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_country_check";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_state_check";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_city_check";

ALTER TABLE "events" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "events" DROP COLUMN IF EXISTS "is_paid";
ALTER TABLE "events" DROP COLUMN IF EXISTS "route_details";
ALTER TABLE "events" DROP COLUMN IF EXISTS "registration_closes_at";
ALTER TABLE "events" DROP COLUMN IF EXISTS "registration_opens_at";
ALTER TABLE "events" DROP COLUMN IF EXISTS "end_at";
ALTER TABLE "events" DROP COLUMN IF EXISTS "start_at";
ALTER TABLE "events" DROP COLUMN IF EXISTS "timezone";
ALTER TABLE "events" DROP COLUMN IF EXISTS "postal_code";
ALTER TABLE "events" DROP COLUMN IF EXISTS "country";
ALTER TABLE "events" DROP COLUMN IF EXISTS "state";
ALTER TABLE "events" DROP COLUMN IF EXISTS "city";
ALTER TABLE "events" DROP COLUMN IF EXISTS "address_line2";
ALTER TABLE "events" DROP COLUMN IF EXISTS "address_line1";
ALTER TABLE "events" DROP COLUMN IF EXISTS "venue_name";
ALTER TABLE "events" DROP COLUMN IF EXISTS "category";
ALTER TABLE "events" DROP COLUMN IF EXISTS "sport";
ALTER TABLE "events" DROP COLUMN IF EXISTS "event_type";
ALTER TABLE "events" DROP COLUMN IF EXISTS "description";

DROP TYPE IF EXISTS "public"."event_currency";
DROP TYPE IF EXISTS "public"."event_sport";
DROP TYPE IF EXISTS "public"."event_category";
DROP TYPE IF EXISTS "public"."event_type";
