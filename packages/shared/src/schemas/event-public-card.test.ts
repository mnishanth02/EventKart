import { describe, expect, it } from "vitest";
import { eventPublicCardSchema } from "./event-public-card.js";

const validCard = {
	slug: "coimbatore-marathon-2026",
	title: "Coimbatore Marathon 2026",
	startAt: "2026-01-10T00:30:00.000Z",
	endAt: "2026-01-10T06:30:00.000Z",
	timezone: "Asia/Kolkata",
	city: "Coimbatore",
	venueName: "VOC Park",
	registrationOpensAt: "2025-08-01T04:30:00.000Z",
	registrationClosesAt: null,
	isPaid: true,
	heroImage: {
		kind: "hero",
		contentType: "image/jpeg",
		url: "https://cdn.example.com/events/coimbatore-marathon.jpg",
		expiresAt: "2026-01-10T00:30:00.000Z",
	},
	categories: [
		{
			name: "10K",
			slug: "10k",
			distanceMeters: 10000,
			capacity: { spotsTotal: 500, spotsRemaining: 125 },
		},
	],
	pricingTiers: [
		{
			categorySlug: "10k",
			basePrice: 99900,
			earlyBirdPrice: 79900,
			earlyBirdDeadline: null,
			currency: "INR",
		},
	],
};

describe("eventPublicCardSchema", () => {
	it("round-trips a valid public event card payload", () => {
		expect(eventPublicCardSchema.parse(validCard)).toEqual(validCard);
	});

	it("rejects a malformed event slug", () => {
		expect(() =>
			eventPublicCardSchema.parse({ ...validCard, slug: "Bad Slug" }),
		).toThrow();
	});

	it("rejects malformed datetime fields", () => {
		expect(() =>
			eventPublicCardSchema.parse({ ...validCard, startAt: "tomorrow" }),
		).toThrow();
	});

	it("rejects category capacity where remaining spots exceed total spots", () => {
		expect(() =>
			eventPublicCardSchema.parse({
				...validCard,
				categories: [
					{
						...validCard.categories[0],
						capacity: { spotsTotal: 10, spotsRemaining: 11 },
					},
				],
			}),
		).toThrow();
	});
});
