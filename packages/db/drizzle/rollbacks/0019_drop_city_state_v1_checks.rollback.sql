-- Rollback for 0019_drop_city_state_v1_checks.sql (re-add city + state V1 CHECKs)
--
-- ⚠️ DATA-DEPENDENT ROLLBACK ⚠️
-- After 0019 ships, organizers may legitimately create events with city/state
-- values other than 'Coimbatore' / 'Tamil Nadu'. PostgreSQL will REFUSE to
-- re-add these CHECK constraints if any such rows exist. To roll back you must
-- first decide how to handle non-conforming rows (delete, normalize, or accept
-- that the rollback cannot run cleanly). Do NOT run this rollback blindly in
-- production after the new contract has been used.
ALTER TABLE "events" ADD CONSTRAINT "events_v1_city_check" CHECK ("city" = 'Coimbatore');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_state_check" CHECK ("state" = 'Tamil Nadu');
