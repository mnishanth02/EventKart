ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_id_event_id_unique" UNIQUE("id","event_id");--> statement-breakpoint
CREATE TABLE "event_pricing_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_category_id" uuid NOT NULL,
	"base_price" integer NOT NULL,
	"early_bird_price" integer,
	"early_bird_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_pricing_tiers_event_id_category_id_unique" UNIQUE("event_id","event_category_id"),
	CONSTRAINT "event_pricing_tiers_base_price_check" CHECK ("base_price" >= 100 AND "base_price" <= 10000000),
	CONSTRAINT "event_pricing_tiers_early_bird_price_check" CHECK ("early_bird_price" IS NULL OR ("early_bird_price" >= 100 AND "early_bird_price" < "base_price")),
	CONSTRAINT "event_pricing_tiers_early_bird_pair_check" CHECK (("early_bird_price" IS NULL AND "early_bird_deadline" IS NULL) OR ("early_bird_price" IS NOT NULL AND "early_bird_deadline" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" ADD CONSTRAINT "event_pricing_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" VALIDATE CONSTRAINT "event_pricing_tiers_event_id_events_id_fk";--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" ADD CONSTRAINT "event_pricing_tiers_event_category_id_event_categories_id_fk" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_categories"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" VALIDATE CONSTRAINT "event_pricing_tiers_event_category_id_event_categories_id_fk";--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" ADD CONSTRAINT "event_pricing_tiers_event_category_event_id_fk" FOREIGN KEY ("event_category_id","event_id") REFERENCES "public"."event_categories"("id","event_id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "event_pricing_tiers" VALIDATE CONSTRAINT "event_pricing_tiers_event_category_event_id_fk";
