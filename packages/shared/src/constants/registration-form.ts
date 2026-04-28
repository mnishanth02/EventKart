import { z } from "zod/v4";

export const EVENT_REGISTRATION_FORM_SCHEMA_VERSION = 1;

export const EVENT_REGISTRATION_FIELD_KINDS = [
	"text",
	"email",
	"phone",
	"date",
	"select",
] as const;
export type EventRegistrationFieldKind =
	(typeof EVENT_REGISTRATION_FIELD_KINDS)[number];
export const eventRegistrationFieldKindSchema = z.enum(
	EVENT_REGISTRATION_FIELD_KINDS,
);

export const STANDARD_REGISTRATION_FIELD_IDS = [
	"full_name",
	"email",
	"phone",
	"date_of_birth",
	"gender",
] as const;
export type StandardRegistrationFieldId =
	(typeof STANDARD_REGISTRATION_FIELD_IDS)[number];

export const FITNESS_REGISTRATION_FIELD_IDS = [
	"blood_group",
	"tshirt_size",
	"emergency_contact_name",
	"emergency_contact_phone",
] as const;
export type FitnessRegistrationFieldId =
	(typeof FITNESS_REGISTRATION_FIELD_IDS)[number];

export const EVENT_REGISTRATION_FIELD_IDS = [
	...STANDARD_REGISTRATION_FIELD_IDS,
	...FITNESS_REGISTRATION_FIELD_IDS,
] as const;
export type EventRegistrationFieldId =
	(typeof EVENT_REGISTRATION_FIELD_IDS)[number];
export const eventRegistrationFieldIdSchema = z.enum(
	EVENT_REGISTRATION_FIELD_IDS,
);

type EventRegistrationFieldCatalogItem = {
	id: EventRegistrationFieldId;
	label: string;
	kind: EventRegistrationFieldKind;
	sensitive: boolean;
	defaultEnabled: boolean;
	defaultRequired: boolean;
	options?: readonly string[];
};

export const EVENT_REGISTRATION_FIELD_CATALOG = {
	full_name: {
		id: "full_name",
		label: "Full name",
		kind: "text",
		sensitive: false,
		defaultEnabled: true,
		defaultRequired: true,
	},
	email: {
		id: "email",
		label: "Email address",
		kind: "email",
		sensitive: false,
		defaultEnabled: true,
		defaultRequired: true,
	},
	phone: {
		id: "phone",
		label: "Phone number",
		kind: "phone",
		sensitive: false,
		defaultEnabled: true,
		defaultRequired: true,
	},
	date_of_birth: {
		id: "date_of_birth",
		label: "Date of birth",
		kind: "date",
		sensitive: true,
		defaultEnabled: false,
		defaultRequired: false,
	},
	gender: {
		id: "gender",
		label: "Gender",
		kind: "select",
		sensitive: true,
		defaultEnabled: false,
		defaultRequired: false,
		options: ["female", "male", "non_binary", "prefer_not_to_say"],
	},
	blood_group: {
		id: "blood_group",
		label: "Blood group",
		kind: "select",
		sensitive: true,
		defaultEnabled: false,
		defaultRequired: false,
		options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
	},
	tshirt_size: {
		id: "tshirt_size",
		label: "T-shirt size",
		kind: "select",
		sensitive: false,
		defaultEnabled: false,
		defaultRequired: false,
		options: ["XS", "S", "M", "L", "XL", "XXL"],
	},
	emergency_contact_name: {
		id: "emergency_contact_name",
		label: "Emergency contact name",
		kind: "text",
		sensitive: true,
		defaultEnabled: false,
		defaultRequired: false,
	},
	emergency_contact_phone: {
		id: "emergency_contact_phone",
		label: "Emergency contact phone",
		kind: "phone",
		sensitive: true,
		defaultEnabled: false,
		defaultRequired: false,
	},
} as const satisfies Record<
	EventRegistrationFieldId,
	EventRegistrationFieldCatalogItem
>;
