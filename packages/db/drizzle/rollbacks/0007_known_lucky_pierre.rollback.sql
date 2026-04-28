-- ROLLBACK for 0007_known_lucky_pierre.sql
-- Removes event slug foundation tables and enums.

DROP INDEX IF EXISTS "slug_redirects_new_slug_idx";
DROP INDEX IF EXISTS "slug_redirects_resource_lookup_idx";
DROP INDEX IF EXISTS "slug_redirects_resource_type_old_slug_unique";
DROP INDEX IF EXISTS "events_status_idx";
DROP INDEX IF EXISTS "events_organizer_id_idx";
DROP INDEX IF EXISTS "events_slug_unique";
DROP TABLE IF EXISTS "slug_redirects";
DROP TABLE IF EXISTS "events";
DROP TYPE IF EXISTS "public"."slug_redirect_resource_type";
DROP TYPE IF EXISTS "public"."event_status";
