ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "form_schema" jsonb DEFAULT '{"version":1,"fields":[{"fieldId":"full_name","enabled":true,"required":true,"safetyCritical":false},{"fieldId":"email","enabled":true,"required":true,"safetyCritical":false},{"fieldId":"phone","enabled":true,"required":true,"safetyCritical":false},{"fieldId":"date_of_birth","enabled":false,"required":false,"safetyCritical":false},{"fieldId":"gender","enabled":false,"required":false,"safetyCritical":false},{"fieldId":"blood_group","enabled":false,"required":false,"safetyCritical":false},{"fieldId":"tshirt_size","enabled":false,"required":false,"safetyCritical":false},{"fieldId":"emergency_contact_name","enabled":false,"required":false,"safetyCritical":false},{"fieldId":"emergency_contact_phone","enabled":false,"required":false,"safetyCritical":false}]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "form_schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'events_form_schema_version_check'
			AND conrelid = 'events'::regclass
	) THEN
		ALTER TABLE "events" ADD CONSTRAINT "events_form_schema_version_check" CHECK ("form_schema" ? 'version' AND ("form_schema"->>'version')::integer = "form_schema_version");
	END IF;
END $$;
