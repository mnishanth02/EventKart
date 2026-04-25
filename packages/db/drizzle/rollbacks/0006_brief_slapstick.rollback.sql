-- ROLLBACK for 0006_brief_slapstick.sql
-- Removes Razorpay linked-account columns and enum from organizers table.

DROP INDEX IF EXISTS "organizers_razorpay_account_id_unique";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_last_synced_at";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_last_error";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_raw_status";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_linked_at";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_account_status";
ALTER TABLE "organizers" DROP COLUMN IF EXISTS "razorpay_account_id";
DROP TYPE IF EXISTS "public"."razorpay_account_status";
