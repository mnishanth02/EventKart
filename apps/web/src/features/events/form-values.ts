import {
	V1_EVENT_CATEGORY,
	V1_EVENT_CITY,
	V1_EVENT_COUNTRY,
	V1_EVENT_CURRENCY,
	V1_EVENT_IS_PAID,
	V1_EVENT_SPORT,
	V1_EVENT_STATE,
	V1_EVENT_TIMEZONE,
	V1_EVENT_TYPE,
} from "@repo/shared/constants";
import type { CreateEventInput, Event } from "@repo/shared/schemas";
import {
	createEventBaseSchema,
	createEventInputSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

const INDIA_OFFSET_MILLISECONDS = 5.5 * 60 * 60 * 1000;
const DATE_TIME_LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

const EDITABLE_EVENT_FIELD_PICK = {
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

const editableEventBaseSchema = createEventBaseSchema.pick(
	EDITABLE_EVENT_FIELD_PICK,
);

export const eventEditValuesSchema = editableEventBaseSchema.transform(
	(input, ctx) => {
		const parsed = createEventInputSchema.safeParse(input);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				ctx.addIssue({
					code: "custom",
					message: issue.message,
					path: issue.path,
				});
			}
			return z.NEVER;
		}

		const event = parsed.data;
		return {
			title: event.title,
			description: event.description,
			venueName: event.venueName,
			addressLine1: event.addressLine1,
			addressLine2: event.addressLine2,
			postalCode: event.postalCode,
			startAt: event.startAt,
			endAt: event.endAt,
			registrationOpensAt: event.registrationOpensAt,
			registrationClosesAt: event.registrationClosesAt,
			routeDetails: event.routeDetails,
		};
	},
);

export type EventEditFormValues = z.input<typeof eventEditValuesSchema>;
export type EventUpdatePayload = z.output<typeof eventEditValuesSchema>;

export function coimbatoreDateTimeLocalToIso(value: string): string {
	if (!value) return "";

	const match = DATE_TIME_LOCAL_PATTERN.exec(value);
	if (!match) return value;

	const date = match[1];
	const hour = match[2];
	const minute = match[3];
	if (!date || !hour || !minute) return value;

	return new Date(`${date}T${hour}:${minute}:00.000+05:30`).toISOString();
}

export function isoToCoimbatoreDateTimeLocal(
	value: string | undefined,
): string {
	if (!value) return "";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	return new Date(date.getTime() + INDIA_OFFSET_MILLISECONDS)
		.toISOString()
		.slice(0, 16);
}

export function getDefaultCreateEventValues(): CreateEventInput {
	return {
		title: "",
		description: "",
		eventType: V1_EVENT_TYPE,
		sport: V1_EVENT_SPORT,
		category: V1_EVENT_CATEGORY,
		venueName: "",
		addressLine1: "",
		addressLine2: undefined,
		city: V1_EVENT_CITY,
		state: V1_EVENT_STATE,
		country: V1_EVENT_COUNTRY,
		postalCode: undefined,
		timezone: V1_EVENT_TIMEZONE,
		startAt: "",
		endAt: "",
		registrationOpensAt: undefined,
		registrationClosesAt: undefined,
		routeDetails: "",
		isPaid: V1_EVENT_IS_PAID,
		currency: V1_EVENT_CURRENCY,
	};
}

export function eventToEditFormValues(event: Event): EventEditFormValues {
	return {
		title: event.title,
		description: event.description,
		venueName: event.venueName,
		addressLine1: event.addressLine1,
		addressLine2: event.addressLine2 ?? undefined,
		postalCode: event.postalCode ?? undefined,
		startAt: event.startAt,
		endAt: event.endAt,
		registrationOpensAt: event.registrationOpensAt ?? undefined,
		registrationClosesAt: event.registrationClosesAt ?? undefined,
		routeDetails: event.routeDetails,
	};
}
