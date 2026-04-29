import { z } from "zod/v4";
import {
	EVENT_REGISTRATION_FIELD_CATALOG,
	EVENT_REGISTRATION_FIELD_IDS,
	EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
	eventRegistrationFieldIdSchema,
} from "../constants/registration-form.js";

export const eventRegistrationFieldConfigSchema = z
	.object({
		fieldId: eventRegistrationFieldIdSchema,
		enabled: z.boolean(),
		required: z.boolean(),
		safetyCritical: z.boolean().default(false),
		safetyCriticalReason: z
			.string()
			.trim()
			.min(1, "Safety-critical reason is required")
			.max(500, "Safety-critical reason must be at most 500 characters")
			.optional(),
	})
	.superRefine((field, ctx) => {
		if (!field.enabled && field.required) {
			ctx.addIssue({
				code: "custom",
				message: "A disabled registration field cannot be required",
				path: ["required"],
			});
		}

		if (!field.enabled && field.safetyCritical) {
			ctx.addIssue({
				code: "custom",
				message: "A disabled registration field cannot be safety-critical",
				path: ["safetyCritical"],
			});
		}

		const catalogItem = EVENT_REGISTRATION_FIELD_CATALOG[field.fieldId];
		const needsSafetyReason =
			catalogItem.sensitive && (field.required || field.safetyCritical);

		if (needsSafetyReason && !field.safetyCriticalReason) {
			ctx.addIssue({
				code: "custom",
				message:
					"Sensitive fields that are required or safety-critical need a safety-critical reason",
				path: ["safetyCriticalReason"],
			});
		}
	});

export const eventRegistrationFormSchema = z
	.object({
		version: z.literal(EVENT_REGISTRATION_FORM_SCHEMA_VERSION),
		fields: z
			.array(eventRegistrationFieldConfigSchema)
			.min(1, "At least one registration field is required")
			.max(
				EVENT_REGISTRATION_FIELD_IDS.length,
				"Registration form contains too many fields",
			),
	})
	.superRefine((form, ctx) => {
		const seenFieldIds = new Map<string, number>();

		form.fields.forEach((field, index) => {
			const existingIndex = seenFieldIds.get(field.fieldId);
			if (existingIndex !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Registration field IDs must be unique per form",
					path: ["fields", index, "fieldId"],
				});
				ctx.addIssue({
					code: "custom",
					message: "Registration field IDs must be unique per form",
					path: ["fields", existingIndex, "fieldId"],
				});
			}

			seenFieldIds.set(field.fieldId, index);
		});
	});

export const defaultEventRegistrationFormSchema = {
	version: EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
	fields: EVENT_REGISTRATION_FIELD_IDS.map((fieldId) => {
		const catalogItem = EVENT_REGISTRATION_FIELD_CATALOG[fieldId];

		return {
			fieldId,
			enabled: catalogItem.defaultEnabled,
			required: catalogItem.defaultRequired,
			safetyCritical: false,
		};
	}),
} satisfies EventRegistrationFormInput;

export type EventRegistrationFieldConfigInput = z.input<
	typeof eventRegistrationFieldConfigSchema
>;
export type EventRegistrationFieldConfig = z.output<
	typeof eventRegistrationFieldConfigSchema
>;
export type EventRegistrationFormInput = z.input<
	typeof eventRegistrationFormSchema
>;
export type EventRegistrationForm = z.output<
	typeof eventRegistrationFormSchema
>;
