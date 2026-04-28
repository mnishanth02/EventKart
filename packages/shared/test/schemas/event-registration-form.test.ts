import { describe, expect, it } from "vitest";
import {
	EVENT_REGISTRATION_FIELD_CATALOG,
	EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
} from "../../src/constants/registration-form";
import {
	defaultEventRegistrationFormSchema,
	eventRegistrationFieldConfigSchema,
	eventRegistrationFormSchema,
} from "../../src/schemas/event-registration-form";

describe("eventRegistrationFieldConfigSchema", () => {
	it("accepts the default catalog field configurations", () => {
		for (const catalogItem of Object.values(EVENT_REGISTRATION_FIELD_CATALOG)) {
			expect(
				eventRegistrationFieldConfigSchema.parse({
					fieldId: catalogItem.id,
					enabled: catalogItem.defaultEnabled,
					required: catalogItem.defaultRequired,
				}),
			).toMatchObject({
				fieldId: catalogItem.id,
				enabled: catalogItem.defaultEnabled,
				required: catalogItem.defaultRequired,
				safetyCritical: false,
			});
		}
	});

	it("rejects required sensitive fields without a safety-critical reason", () => {
		const result = eventRegistrationFieldConfigSchema.safeParse({
			fieldId: "blood_group",
			enabled: true,
			required: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message:
							"Sensitive fields that are required or safety-critical need a safety-critical reason",
						path: ["safetyCriticalReason"],
					}),
				]),
			);
		}
	});

	it("rejects required disabled fields", () => {
		const result = eventRegistrationFieldConfigSchema.safeParse({
			fieldId: "email",
			enabled: false,
			required: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "A disabled registration field cannot be required",
						path: ["required"],
					}),
				]),
			);
		}
	});

	it("rejects safety-critical disabled fields", () => {
		const result = eventRegistrationFieldConfigSchema.safeParse({
			fieldId: "emergency_contact_phone",
			enabled: false,
			required: false,
			safetyCritical: true,
			safetyCriticalReason: "Needed for medical escalation.",
		});

		expect(result.success).toBe(false);
	});

	it("rejects safety-critical sensitive fields without a reason", () => {
		const result = eventRegistrationFieldConfigSchema.safeParse({
			fieldId: "emergency_contact_phone",
			enabled: true,
			required: false,
			safetyCritical: true,
		});

		expect(result.success).toBe(false);
	});

	it("accepts safety-critical sensitive fields with a reason", () => {
		const result = eventRegistrationFieldConfigSchema.parse({
			fieldId: "emergency_contact_phone",
			enabled: true,
			required: true,
			safetyCritical: true,
			safetyCriticalReason: "Needed for same-day medical escalation.",
		});

		expect(result.safetyCriticalReason).toBe(
			"Needed for same-day medical escalation.",
		);
	});
});

describe("eventRegistrationFormSchema", () => {
	it("accepts the default event registration form schema", () => {
		const result = eventRegistrationFormSchema.parse(
			defaultEventRegistrationFormSchema,
		);

		expect(result.version).toBe(EVENT_REGISTRATION_FORM_SCHEMA_VERSION);
		expect(result.fields.map((field) => field.fieldId)).toEqual(
			Object.values(EVENT_REGISTRATION_FIELD_CATALOG).map((field) => field.id),
		);
	});

	it("rejects duplicate fields", () => {
		const result = eventRegistrationFormSchema.safeParse({
			version: EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
			fields: [
				{ fieldId: "full_name", enabled: true, required: true },
				{ fieldId: "full_name", enabled: true, required: false },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Registration field IDs must be unique per form",
						path: ["fields", 1, "fieldId"],
					}),
				]),
			);
		}
	});
});
