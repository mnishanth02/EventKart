CREATE TYPE "public"."event_image_kind" AS ENUM('hero', 'route_map');--> statement-breakpoint
CREATE TYPE "public"."event_image_status" AS ENUM('pending', 'uploaded', 'replaced', 'deleted');--> statement-breakpoint
CREATE TABLE "event_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "event_image_kind" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer,
	"storage_key" varchar(500) NOT NULL,
	"status" "event_image_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_images_content_type_check" CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "event_images_size_bytes_positive_check" CHECK ("size_bytes" IS NULL OR "size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_images" VALIDATE CONSTRAINT "event_images_event_id_events_id_fk";--> statement-breakpoint
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_images" VALIDATE CONSTRAINT "event_images_uploaded_by_users_id_fk";--> statement-breakpoint
CREATE UNIQUE INDEX "event_images_storage_key_unique" ON "event_images" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "event_images_event_id_idx" ON "event_images" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_images_status_idx" ON "event_images" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_images_active_event_kind_idx" ON "event_images" USING btree ("event_id","kind") WHERE status IN ('pending', 'uploaded');
