// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverApiClient } from "#/lib/api-client.server";
import { getPublicEventOnServer } from "./api.server";
import { eventPublicDetailSchema } from "@repo/shared/schemas";
import type { EventPublicDetail, EventPublicLookupApiEnvelope } from "./types";

vi.mock("#/lib/api-client.server", () => ({
	serverApiClient: vi.fn(),
}));

const eventDetail: EventPublicDetail = eventPublicDetailSchema.parse({
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description: "A public running event through Race Course.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road",
	addressLine2: null,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: "641018",
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: null,
	registrationClosesAt: null,
	routeDetails: "One loop around Race Course.",
	refundPolicy: null,
	cancellationPolicy: null,
	isPaid: true,
	currency: "INR",
	organizer: {
		slug: "race-coimbatore",
		businessName: "Race Coimbatore",
		isVerified: true,
		city: "Coimbatore",
	},
	heroImage: null,
	routeMapImage: null,
	categories: [],
	pricingTiers: [],
});

describe("getPublicEventOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
	});

	it("passes through a successful event payload", async () => {
		const response = {
			success: true,
			data: { kind: "event", data: eventDetail },
		} satisfies EventPublicLookupApiEnvelope;
		vi.mocked(serverApiClient).mockResolvedValueOnce(response);

		await expect(getPublicEventOnServer(eventDetail.slug)).resolves.toBe(
			response,
		);
		expect(serverApiClient).toHaveBeenCalledWith(
			"/events/by-slug/coimbatore-city-10k",
		);
	});

	it("passes through a successful redirect payload", async () => {
		const response = {
			success: true,
			data: { kind: "redirect", newSlug: eventDetail.slug },
		} satisfies EventPublicLookupApiEnvelope;
		vi.mocked(serverApiClient).mockResolvedValueOnce(response);

		await expect(getPublicEventOnServer("old-coimbatore-10k")).resolves.toBe(
			response,
		);
	});

	it("rethrows 404 errors for the loader to branch on", async () => {
		const error = Object.assign(new Error("Not found"), { status: 404 });
		vi.mocked(serverApiClient).mockRejectedValueOnce(error);

		await expect(getPublicEventOnServer("missing-event")).rejects.toBe(error);
	});

	it("encodes the slug once when building the request URL", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { kind: "event", data: eventDetail },
		});

		await getPublicEventOnServer("coimbatore city 10k");

		expect(serverApiClient).toHaveBeenCalledWith(
			"/events/by-slug/coimbatore%20city%2010k",
		);
		expect(serverApiClient).not.toHaveBeenCalledWith(
			expect.stringContaining("%2520"),
		);
	});
});
