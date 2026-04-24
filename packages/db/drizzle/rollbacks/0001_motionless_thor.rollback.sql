-- Rollback 0001_motionless_thor.sql
-- Reverse in order: drop new objects, restore dropped objects

-- Drop new indexes on organizers
DROP INDEX IF EXISTS "organizers_city_idx";
DROP INDEX IF EXISTS "organizers_verification_status_idx";
DROP INDEX IF EXISTS "organizers_user_id_unique";

-- Drop new indexes on email_verifications
DROP INDEX IF EXISTS "email_verifications_user_id_idx";
DROP INDEX IF EXISTS "email_verifications_token_hash_unique";

-- Drop new unique index on users.email (restore old non-unique index after)
DROP INDEX IF EXISTS "users_email_unique";

-- Drop FK constraints
ALTER TABLE "organizers" DROP CONSTRAINT IF EXISTS "organizers_user_id_users_id_fk";
ALTER TABLE "email_verifications" DROP CONSTRAINT IF EXISTS "email_verifications_user_id_users_id_fk";

-- Drop updated_at column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_at";

-- Restore original email index (non-unique)
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");

-- Restore consent_records FK
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Drop new tables
DROP TABLE IF EXISTS "organizers";
DROP TABLE IF EXISTS "email_verifications";

-- Drop new enum
DROP TYPE IF EXISTS "verification_status";
