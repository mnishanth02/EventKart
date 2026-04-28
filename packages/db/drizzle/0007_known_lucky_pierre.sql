CREATE TYPE "public"."event_status" AS ENUM('draft', 'under_review', 'published', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slug_redirect_resource_type" AS ENUM('event', 'organizer');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" varchar(120) NOT NULL,
	"new_slug" varchar(120) NOT NULL,
	"resource_type" "slug_redirect_resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_unique" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_resource_type_old_slug_unique" ON "slug_redirects" USING btree ("resource_type","old_slug");--> statement-breakpoint
CREATE INDEX "slug_redirects_resource_lookup_idx" ON "slug_redirects" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "slug_redirects_new_slug_idx" ON "slug_redirects" USING btree ("resource_type","new_slug");