CREATE TABLE "event_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"distance_meters" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_categories_event_id_slug_unique" UNIQUE("event_id","slug"),
	CONSTRAINT "event_categories_event_id_name_unique" UNIQUE("event_id","name"),
	CONSTRAINT "event_categories_event_id_sort_order_unique" UNIQUE("event_id","sort_order"),
	CONSTRAINT "event_categories_name_not_blank_check" CHECK (char_length(btrim("name")) > 0),
	CONSTRAINT "event_categories_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "event_categories_distance_positive_check" CHECK ("distance_meters" > 0),
	CONSTRAINT "event_categories_sort_order_non_negative_check" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_categories" VALIDATE CONSTRAINT "event_categories_event_id_events_id_fk";
