import {
	V1_EVENT_ALLOWED_VALUES,
	V1_EVENT_CITY,
	V1_EVENT_TIMEZONE,
} from "@repo/shared/constants";
import { eventSchema } from "@repo/shared/schemas";
import { describe, expect, it } from "vitest";
import {
	coimbatoreDateTimeLocalToIso,
	eventEditValuesSchema,
	eventToEditFormValues,
	getDefaultCreateEventValues,
	isoToCoimbatoreDateTimeLocal,
} from "./form-values";

describe("event form values", () => {
	it("sets V1 defaults for paid running events in Coimbatore", () => {
		expect(getDefaultCreateEventValues()).toMatchObject({
			...V1_EVENT_ALLOWED_VALUES,
			city: V1_EVENT_CITY,
			timezone: V1_EVENT_TIMEZONE,
		});
	});

	it("converts Coimbatore local datetime values to ISO strings", () => {
		expect(coimbatoreDateTimeLocalToIso("2026-08-15T06:00")).toBe(
			"2026-08-15T00:30:00.000Z",
		);
	});

	it("converts ISO strings back to Coimbatore local datetime values", () => {
		expect(isoToCoimbatoreDateTimeLocal("2026-08-15T00:30:00.000Z")).toBe(
			"2026-08-15T06:00",
		);
	});

	it("maps an event response to editable values without immutable fields", () => {
		const values = eventToEditFormValues(
			eventSchema.parse({
				id: "11111111-1111-4111-8111-111111111111",
				organizerId: "22222222-2222-4222-8222-222222222222",
				slug: "coimbatore-city-10k",
				title: "Coimbatore City 10K",
				description: "A paid running event for Coimbatore city runners.",
				eventType: "race",
				sport: "running",
				category: "running",
				venueName: "Race Course Grounds",
				addressLine1: "Race Course Road, Gopalapuram",
				addressLine2: null,
				city: "Coimbatore",
				state: "Tamil Nadu",
				country: "India",
				postalCode: null,
				timezone: "Asia/Kolkata",
				startAt: "2026-08-15T00:30:00.000Z",
				endAt: "2026-08-15T03:30:00.000Z",
				registrationOpensAt: null,
				registrationClosesAt: null,
				routeDetails: "Single-loop route through Race Course Road.",
				refundPolicy: null,
				cancellationPolicy: null,
				publishedAt: null,
				firstPublishedAt: null,
				submittedForReviewAt: null,
				isPaid: true,
				currency: "INR",
				status: "draft",
				createdAt: "2026-04-26T12:00:00.000Z",
				updatedAt: "2026-04-26T12:00:00.000Z",
			}),
		);

		expect(values).toEqual({
			title: "Coimbatore City 10K",
			description: "A paid running event for Coimbatore city runners.",
			venueName: "Race Course Grounds",
			addressLine1: "Race Course Road, Gopalapuram",
			addressLine2: undefined,
			postalCode: undefined,
			startAt: "2026-08-15T00:30:00.000Z",
			endAt: "2026-08-15T03:30:00.000Z",
			registrationOpensAt: undefined,
			registrationClosesAt: undefined,
			routeDetails: "Single-loop route through Race Course Road.",
		});
	});

	it("validates editable event values using create-event date rules", () => {
		const result = eventEditValuesSchema.safeParse({
			title: "Coimbatore City 10K",
			description: "A paid running event for Coimbatore city runners.",
			venueName: "Race Course Grounds",
			addressLine1: "Race Course Road, Gopalapuram",
			startAt: "2026-08-15T03:30:00.000Z",
			endAt: "2026-08-15T00:30:00.000Z",
			routeDetails: "Single-loop route through Race Course Road.",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe(
				"Event end time must be after the start time",
			);
		}
	});
});
