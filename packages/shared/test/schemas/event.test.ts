import { describe, expect, it } from "vitest";
import {
	V1_EVENT_ALLOWED_VALUES,
	V1_EVENT_CITY,
	V1_EVENT_TIMEZONE,
} from "../../src/constants/event";
import {
	createEventInputSchema,
	eventSchema,
	updateEventInputSchema,
} from "../../src/schemas/event";
import { defaultEventRegistrationFormSchema } from "../../src/schemas/event-registration-form";

const validCreateEventInput = {
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
};

describe("createEventInputSchema", () => {
	it("applies V1 defaults for paid running events in Coimbatore", () => {
		const result = createEventInputSchema.parse(validCreateEventInput);

		expect(result).toMatchObject({
			...V1_EVENT_ALLOWED_VALUES,
			title: "Coimbatore City 10K",
		});
	});

	it("rejects non-Coimbatore events", () => {
		const result = createEventInputSchema.safeParse({
			...validCreateEventInput,
			city: "Chennai",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe(
				"V1 event creation is limited to Coimbatore",
			);
		}
	});

	it("rejects multi-day events in the V1 timezone", () => {
		const result = createEventInputSchema.safeParse({
			...validCreateEventInput,
			startAt: "2026-08-15T17:30:00.000Z",
			endAt: "2026-08-16T01:30:00.000Z",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "V1 events must start and end on the same day",
						path: ["endAt"],
					}),
				]),
			);
		}
	});

	it("uses the Asia/Kolkata calendar day at the midnight boundary", () => {
		const result = createEventInputSchema.safeParse({
			...validCreateEventInput,
			startAt: "2026-08-14T18:30:00.000Z",
			endAt: "2026-08-14T20:30:00.000Z",
		});

		expect(result.success).toBe(true);
	});

	it("requires a complete registration window when one side is provided", () => {
		const result = createEventInputSchema.safeParse({
			...validCreateEventInput,
			registrationClosesAt: undefined,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Provide both registration open and close times",
						path: ["registrationClosesAt"],
					}),
				]),
			);
		}
	});

	it("rejects registration windows that close after event start", () => {
		const result = createEventInputSchema.safeParse({
			...validCreateEventInput,
			registrationClosesAt: "2026-08-15T01:30:00.000Z",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Registration must close before the event starts",
						path: ["registrationClosesAt"],
					}),
				]),
			);
		}
	});
});

describe("updateEventInputSchema", () => {
	it("accepts the editable core event fields", () => {
		const result = updateEventInputSchema.parse({
			...validCreateEventInput,
			title: "  Updated Coimbatore City 10K  ",
			addressLine2: "  Near main gate  ",
			postalCode: " 641018 ",
		});

		expect(result).toMatchObject({
			title: "Updated Coimbatore City 10K",
			addressLine2: "Near main gate",
			postalCode: "641018",
		});
	});

	it("rejects immutable V1 fields", () => {
		const result = updateEventInputSchema.safeParse({
			...validCreateEventInput,
			city: "Coimbatore",
			eventType: "race",
			isPaid: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "unrecognized_keys",
					}),
				]),
			);
		}
	});

	it("rejects empty update payloads", () => {
		const result = updateEventInputSchema.safeParse({});

		expect(result.success).toBe(false);
	});

	it("keeps create-equivalent event date validation", () => {
		const result = updateEventInputSchema.safeParse({
			...validCreateEventInput,
			startAt: "2026-08-15T03:30:00.000Z",
			endAt: "2026-08-15T00:30:00.000Z",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Event end time must be after the start time",
						path: ["endAt"],
					}),
				]),
			);
		}
	});

	it("requires a complete registration window on update", () => {
		const result = updateEventInputSchema.safeParse({
			...validCreateEventInput,
			registrationClosesAt: undefined,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Provide both registration open and close times",
						path: ["registrationClosesAt"],
					}),
				]),
			);
		}
	});
});

describe("eventSchema", () => {
	it("accepts public event output shape", () => {
		const result = eventSchema.parse({
			id: "11111111-1111-4111-8111-111111111111",
			organizerId: "22222222-2222-4222-8222-222222222222",
			slug: "coimbatore-city-10k",
			...validCreateEventInput,
			...V1_EVENT_ALLOWED_VALUES,
			addressLine2: null,
			postalCode: null,
			refundPolicy: null,
			cancellationPolicy: null,
			publishedAt: null,
			firstPublishedAt: null,
			submittedForReviewAt: null,
			status: "draft",
			formSchema: defaultEventRegistrationFormSchema,
			formSchemaVersion: defaultEventRegistrationFormSchema.version,
			createdAt: "2026-04-26T12:00:00.000Z",
			updatedAt: "2026-04-26T12:00:00.000Z",
		});

		expect(result.city).toBe(V1_EVENT_CITY);
		expect(result.formSchema?.version).toBe(
			defaultEventRegistrationFormSchema.version,
		);
		expect(result.timezone).toBe(V1_EVENT_TIMEZONE);
	});
});
