CREATE TYPE "public"."document_status" AS ENUM('pending', 'uploaded', 'replaced', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."verification_document_type" AS ENUM('aadhaar', 'pan', 'gst_certificate', 'bank_proof');--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"document_type" "verification_document_type" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"file_size" integer,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_documents_organizer_idx" ON "verification_documents" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "verification_documents_organizer_type_idx" ON "verification_documents" USING btree ("organizer_id","document_type","status");