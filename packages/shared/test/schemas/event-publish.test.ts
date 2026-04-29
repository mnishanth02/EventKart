import { describe, expect, it } from "vitest";
import {
	eventPublishTransitionSchema,
	publishEventResponseSchema,
	publishReadinessSchema,
	unpublishEventResponseSchema,
} from "../../src/schemas/index.js";

const event = {
	id: "00000000-0000-4000-8000-000000000001",
	organizerId: "00000000-0000-4000-8000-000000000002",
	slug: "coimbatore-marathon",
	title: "Coimbatore Marathon",
	description: "A city marathon for runners.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Park",
	addressLine1: "Race Course Road",
	addressLine2: null,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: null,
	timezone: "Asia/Kolkata",
	startAt: "2027-01-10T01:30:00.000Z",
	endAt: "2027-01-10T05:30:00.000Z",
	registrationOpensAt: null,
	registrationClosesAt: null,
	routeDetails: "Start and finish at Race Course.",
	refundPolicy: "Refunds close seven days before the event.",
	cancellationPolicy: "Organizer cancellations are fully refunded.",
	publishedAt: null,
	submittedForReviewAt: null,
	isPaid: true,
	currency: "INR",
	status: "draft",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const readiness = {
	ready: true,
	eventStatus: "draft",
	isPaid: true,
	requiresRazorpay: true,
	wouldRequireAdminReview: false,
	items: [
		{
			check: "organizer_verified",
			passed: true,
			message: "Organizer verified",
			severity: "error",
		},
	],
};

describe("event publish schemas", () => {
	it("accepts publish readiness payloads", () => {
		expect(publishReadinessSchema.parse(readiness)).toEqual(readiness);
	});

	it("accepts all supported transition values", () => {
		expect(
			eventPublishTransitionSchema.parse("noop_already_under_review"),
		).toBe("noop_already_under_review");
		expect(eventPublishTransitionSchema.parse("under_review_to_draft")).toBe(
			"under_review_to_draft",
		);
	});

	it("accepts publish and unpublish responses", () => {
		expect(
			publishEventResponseSchema.parse({
				success: true,
				data: {
					event: {
						...event,
						status: "published",
						publishedAt: event.updatedAt,
					},
					transition: "draft_to_published",
					readiness,
				},
			}).data.transition,
		).toBe("draft_to_published");

		expect(
			unpublishEventResponseSchema.parse({
				success: true,
				data: {
					event,
					transition: "published_to_draft",
				},
			}).data.transition,
		).toBe("published_to_draft");
	});
});
