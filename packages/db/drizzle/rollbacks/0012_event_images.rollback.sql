DROP INDEX IF EXISTS "event_images_active_event_kind_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "event_images_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "event_images_event_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "event_images_storage_key_unique";--> statement-breakpoint
ALTER TABLE "event_images" DROP CONSTRAINT IF EXISTS "event_images_uploaded_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "event_images" DROP CONSTRAINT IF EXISTS "event_images_event_id_events_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "event_images";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."event_image_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."event_image_kind";
