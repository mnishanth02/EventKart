import { z } from "zod/v4";
import {
	eventCategorySchema,
	eventCurrencySchema,
	eventSportSchema,
	eventStatusSchema,
	eventTypeSchema,
	V1_EVENT_CATEGORY,
	V1_EVENT_CITY,
	V1_EVENT_COUNTRY,
	V1_EVENT_CURRENCY,
	V1_EVENT_IS_PAID,
	V1_EVENT_SPORT,
	V1_EVENT_STATE,
	V1_EVENT_TIMEZONE,
	V1_EVENT_TYPE,
} from "../constants/event.js";
import { EVENT_REGISTRATION_FORM_SCHEMA_VERSION } from "../constants/registration-form.js";
import { eventRegistrationFormSchema } from "./event-registration-form.js";
import { eventSlugSchema } from "./event-slug.js";

const EVENT_TITLE_MAX_LENGTH = 200;
const EVENT_DESCRIPTION_MAX_LENGTH = 5000;
const EVENT_VENUE_MAX_LENGTH = 200;
const EVENT_ADDRESS_MAX_LENGTH = 255;
const EVENT_POSTAL_CODE_MAX_LENGTH = 20;
const EVENT_ROUTE_DETAILS_MAX_LENGTH = 5000;

const eventDateTimeSchema = z
	.string()
	.datetime({ message: "Enter a valid date and time" });

const eventOptionalDateTimeSchema = eventDateTimeSchema.optional();

const editableEventFields = {
	title: true,
	description: true,
	venueName: true,
	addressLine1: true,
	addressLine2: true,
	postalCode: true,
	startAt: true,
	endAt: true,
	registrationOpensAt: true,
	registrationClosesAt: true,
	routeDetails: true,
} as const;

function parseDateTime(value: string): Date {
	return new Date(value);
}

const coimbatoreDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: V1_EVENT_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function getCoimbatoreDateKey(value: string): string {
	const parts = coimbatoreDateFormatter.formatToParts(parseDateTime(value));
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;

	if (!year || !month || !day) {
		throw new Error("Unable to format event date");
	}

	return `${year}-${month}-${day}`;
}

export const createEventBaseSchema = z.object({
	title: z
		.string()
		.min(3, "Event title must be at least 3 characters")
		.max(
			EVENT_TITLE_MAX_LENGTH,
			`Event title must not exceed ${EVENT_TITLE_MAX_LENGTH} characters`,
		)
		.trim(),
	description: z
		.string()
		.min(20, "Event description must be at least 20 characters")
		.max(
			EVENT_DESCRIPTION_MAX_LENGTH,
			`Event description must not exceed ${EVENT_DESCRIPTION_MAX_LENGTH} characters`,
		)
		.trim(),
	eventType: eventTypeSchema.default(V1_EVENT_TYPE),
	sport: eventSportSchema.default(V1_EVENT_SPORT),
	category: eventCategorySchema.default(V1_EVENT_CATEGORY),
	venueName: z
		.string()
		.min(2, "Venue name must be at least 2 characters")
		.max(
			EVENT_VENUE_MAX_LENGTH,
			`Venue name must not exceed ${EVENT_VENUE_MAX_LENGTH} characters`,
		)
		.trim(),
	addressLine1: z
		.string()
		.min(5, "Address must be at least 5 characters")
		.max(
			EVENT_ADDRESS_MAX_LENGTH,
			`Address must not exceed ${EVENT_ADDRESS_MAX_LENGTH} characters`,
		)
		.trim(),
	addressLine2: z
		.string()
		.max(
			EVENT_ADDRESS_MAX_LENGTH,
			`Address line 2 must not exceed ${EVENT_ADDRESS_MAX_LENGTH} characters`,
		)
		.trim()
		.optional(),
	city: z
		.literal(V1_EVENT_CITY, {
			message: "V1 event creation is limited to Coimbatore",
		})
		.default(V1_EVENT_CITY),
	state: z
		.literal(V1_EVENT_STATE, {
			message: "V1 event creation is limited to Tamil Nadu",
		})
		.default(V1_EVENT_STATE),
	country: z
		.literal(V1_EVENT_COUNTRY, {
			message: "V1 event creation is limited to India",
		})
		.default(V1_EVENT_COUNTRY),
	postalCode: z
		.string()
		.max(
			EVENT_POSTAL_CODE_MAX_LENGTH,
			`Postal code must not exceed ${EVENT_POSTAL_CODE_MAX_LENGTH} characters`,
		)
		.trim()
		.optional(),
	timezone: z
		.literal(V1_EVENT_TIMEZONE, {
			message: "V1 event creation uses Asia/Kolkata timezone",
		})
		.default(V1_EVENT_TIMEZONE),
	startAt: eventDateTimeSchema,
	endAt: eventDateTimeSchema,
	registrationOpensAt: eventOptionalDateTimeSchema,
	registrationClosesAt: eventOptionalDateTimeSchema,
	routeDetails: z
		.string()
		.min(10, "Route details must be at least 10 characters")
		.max(
			EVENT_ROUTE_DETAILS_MAX_LENGTH,
			`Route details must not exceed ${EVENT_ROUTE_DETAILS_MAX_LENGTH} characters`,
		)
		.trim(),
	isPaid: z
		.literal(V1_EVENT_IS_PAID, {
			message: "V1 only supports paid events",
		})
		.default(V1_EVENT_IS_PAID),
	currency: eventCurrencySchema.default(V1_EVENT_CURRENCY),
});

function validateEventSchedule(
	input: {
		startAt: string;
		endAt: string;
		registrationOpensAt?: string;
		registrationClosesAt?: string;
	},
	ctx: z.RefinementCtx,
) {
	const startAt = parseDateTime(input.startAt);
	const endAt = parseDateTime(input.endAt);

	if (startAt >= endAt) {
		ctx.addIssue({
			code: "custom",
			message: "Event end time must be after the start time",
			path: ["endAt"],
		});
	}

	if (
		getCoimbatoreDateKey(input.startAt) !== getCoimbatoreDateKey(input.endAt)
	) {
		ctx.addIssue({
			code: "custom",
			message: "V1 events must start and end on the same day",
			path: ["endAt"],
		});
	}

	const hasRegistrationOpensAt = input.registrationOpensAt !== undefined;
	const hasRegistrationClosesAt = input.registrationClosesAt !== undefined;

	if (hasRegistrationOpensAt !== hasRegistrationClosesAt) {
		ctx.addIssue({
			code: "custom",
			message: "Provide both registration open and close times",
			path: hasRegistrationOpensAt
				? ["registrationClosesAt"]
				: ["registrationOpensAt"],
		});
	}

	if (input.registrationOpensAt && input.registrationClosesAt) {
		const registrationOpensAt = parseDateTime(input.registrationOpensAt);
		const registrationClosesAt = parseDateTime(input.registrationClosesAt);

		if (registrationOpensAt >= registrationClosesAt) {
			ctx.addIssue({
				code: "custom",
				message: "Registration close time must be after the open time",
				path: ["registrationClosesAt"],
			});
		}

		if (registrationClosesAt > startAt) {
			ctx.addIssue({
				code: "custom",
				message: "Registration must close before the event starts",
				path: ["registrationClosesAt"],
			});
		}
	}
}

export const createEventInputSchema = createEventBaseSchema.superRefine(
	validateEventSchedule,
);

export const updateEventInputSchema = createEventBaseSchema
	.pick(editableEventFields)
	.strict()
	.superRefine(validateEventSchedule);

export const eventSchema = z.object({
	id: z.string().uuid(),
	organizerId: z.string().uuid(),
	slug: eventSlugSchema,
	title: z.string(),
	description: z.string(),
	eventType: eventTypeSchema,
	sport: eventSportSchema,
	category: eventCategorySchema,
	venueName: z.string(),
	addressLine1: z.string(),
	addressLine2: z.string().nullable(),
	city: z.string(),
	state: z.string(),
	country: z.string(),
	postalCode: z.string().nullable(),
	timezone: z.string(),
	startAt: eventDateTimeSchema,
	endAt: eventDateTimeSchema,
	registrationOpensAt: eventDateTimeSchema.nullable(),
	registrationClosesAt: eventDateTimeSchema.nullable(),
	routeDetails: z.string(),
	refundPolicy: z.string().nullable(),
	cancellationPolicy: z.string().nullable(),
	publishedAt: eventDateTimeSchema.nullable(),
	submittedForReviewAt: eventDateTimeSchema.nullable(),
	isPaid: z.boolean(),
	currency: eventCurrencySchema,
	status: eventStatusSchema,
	formSchema: eventRegistrationFormSchema.optional(),
	formSchemaVersion: z
		.literal(EVENT_REGISTRATION_FORM_SCHEMA_VERSION)
		.optional(),
	createdAt: eventDateTimeSchema,
	updatedAt: eventDateTimeSchema,
});

export type CreateEventInput = z.input<typeof createEventInputSchema>;
export type CreateEvent = z.output<typeof createEventInputSchema>;
export type UpdateEventInput = z.input<typeof updateEventInputSchema>;
export type UpdateEvent = z.output<typeof updateEventInputSchema>;
export type Event = z.infer<typeof eventSchema>;
