import {
	EVENT_REGISTRATION_FIELD_CATALOG,
	EVENT_REGISTRATION_FIELD_IDS,
	EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
} from "@repo/shared/constants";
import type {
	EventRegistrationFieldConfigInput,
	EventRegistrationFormInput,
} from "@repo/shared/schemas";
import { defaultEventRegistrationFormSchema } from "@repo/shared/schemas";

export function getDefaultEventRegistrationFormConfigValues(): EventRegistrationFormInput {
	return {
		version: defaultEventRegistrationFormSchema.version,
		fields: defaultEventRegistrationFormSchema.fields.map((field) => ({
			...field,
		})),
	};
}

export function normalizeEventRegistrationFormValues(
	form: EventRegistrationFormInput,
): EventRegistrationFormInput {
	return {
		version: EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
		fields: form.fields.map((field) => {
			const safetyCriticalReason = field.safetyCriticalReason?.trim();

			return {
				fieldId: field.fieldId,
				enabled: field.enabled,
				required: field.enabled ? field.required : false,
				safetyCritical: field.enabled ? field.safetyCritical : false,
				...(safetyCriticalReason ? { safetyCriticalReason } : {}),
			};
		}),
	};
}

export function eventRegistrationFormToConfigValues(
	form: EventRegistrationFormInput | null | undefined,
): EventRegistrationFormInput {
	const defaultsByFieldId = new Map(
		defaultEventRegistrationFormSchema.fields.map(
			(field) => [field.fieldId, field] as const,
		),
	);
	const savedByFieldId = new Map(
		form?.fields.map((field) => [field.fieldId, field] as const) ?? [],
	);

	return normalizeEventRegistrationFormValues({
		version: EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
		fields: EVENT_REGISTRATION_FIELD_IDS.map((fieldId) => {
			const catalogItem = EVENT_REGISTRATION_FIELD_CATALOG[fieldId];
			const defaultField = defaultsByFieldId.get(fieldId);
			const savedField = savedByFieldId.get(fieldId);

			return {
				fieldId,
				enabled:
					savedField?.enabled ??
					defaultField?.enabled ??
					catalogItem.defaultEnabled,
				required:
					savedField?.required ??
					defaultField?.required ??
					catalogItem.defaultRequired,
				safetyCritical: savedField?.safetyCritical ?? false,
				...(savedField?.safetyCriticalReason
					? { safetyCriticalReason: savedField.safetyCriticalReason }
					: {}),
			} satisfies EventRegistrationFieldConfigInput;
		}),
	});
}
