CREATE TYPE "public"."event_category" AS ENUM('running');--> statement-breakpoint
CREATE TYPE "public"."event_currency" AS ENUM('INR');--> statement-breakpoint
CREATE TYPE "public"."event_sport" AS ENUM('running');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('race');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "description" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" "event_type" DEFAULT 'race' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sport" "event_sport" DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "category" "event_category" DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_name" varchar(200) DEFAULT 'TBD' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "venue_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "address_line1" varchar(255) DEFAULT 'TBD' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "address_line1" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "address_line2" varchar(255);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "city" varchar(100) DEFAULT 'Coimbatore' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "state" varchar(100) DEFAULT 'Tamil Nadu' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "country" varchar(100) DEFAULT 'India' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "start_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "end_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "route_details" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "route_details" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_paid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "currency" "event_currency" DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_city_check" CHECK ("city" = 'Coimbatore');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_state_check" CHECK ("state" = 'Tamil Nadu');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_country_check" CHECK ("country" = 'India');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_timezone_check" CHECK ("timezone" = 'Asia/Kolkata');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_paid_check" CHECK ("is_paid" = true);
