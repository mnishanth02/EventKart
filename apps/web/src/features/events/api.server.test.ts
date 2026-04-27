// @vitest-environment node
import type {
	CreateEvent,
	EventCategoriesConfig,
	EventImageUploadUrlRequest,
	EventPricingConfig,
} from "@repo/shared/schemas";
import {
	defaultEventCategoriesConfig,
	eventCategoriesConfigSchema,
	eventPricingConfigSchema,
} from "@repo/shared/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import {
	createEventOnServer,
	confirmEventImageUploadOnServer,
	deleteEventImageOnServer,
	getEventOnServer,
	listEventImagesOnServer,
	listEventCategoriesOnServer,
	listEventPricingOnServer,
	requestEventImageUploadUrlOnServer,
	replaceEventCategoriesOnServer,
	replaceEventPricingOnServer,
	updateEventOnServer,
} from "./api.server";
import type { EventUpdatePayload } from "./form-values";

vi.mock("#/lib/api-client.server", () => ({
	serverApiClient: vi.fn(),
}));

vi.mock("#/lib/auth/server-fns.server", () => ({
	assertSameOriginMutationRequest: vi.fn(),
	getForwardedAuthHeaders: vi.fn(),
}));

const validCreateEvent = {
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	addressLine2: undefined,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: undefined,
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
	isPaid: true,
	currency: "INR",
} satisfies CreateEvent;

const eventId = "11111111-1111-4111-8111-111111111111";
const imageId = "55555555-5555-4555-8555-555555555555";
const validCategoryConfig = eventCategoriesConfigSchema.parse(
	defaultEventCategoriesConfig,
) satisfies EventCategoriesConfig;

const validPricingConfig = eventPricingConfigSchema.parse({
	tiers: [
		{
			eventCategoryId: "33333333-3333-4333-8333-333333333330",
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		},
		{
			eventCategoryId: "33333333-3333-4333-8333-333333333331",
			basePrice: 1499,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
		},
	],
}) satisfies EventPricingConfig;

const categoryRecords = validCategoryConfig.categories.map(
	(category, index) => ({
		...category,
		id: `33333333-3333-4333-8333-33333333333${index}`,
		eventId,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	}),
);

const pricingTiers = validPricingConfig.tiers.map((tier, index) => ({
	id: `44444444-4444-4444-8444-44444444444${index}`,
	eventId,
	eventCategoryId: tier.eventCategoryId,
	basePrice: tier.basePrice,
	earlyBirdPrice: tier.earlyBirdPrice ?? null,
	earlyBirdDeadline: tier.earlyBirdDeadline ?? null,
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
	category: categoryRecords[index],
}));

const validImageUploadRequest = {
	kind: "hero",
	fileName: "hero.png",
	contentType: "image/png",
	sizeBytes: 2048,
} satisfies EventImageUploadUrlRequest;

const eventImage = {
	id: imageId,
	eventId,
	kind: "hero",
	fileName: "hero.png",
	contentType: "image/png",
	sizeBytes: 2048,
	storageKey: "events/event-1/hero.png",
	status: "uploaded",
	uploadedBy: "22222222-2222-4222-8222-222222222222",
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
} as const;

const eventResponse = {
	...validCreateEvent,
	id: eventId,
	organizerId: "22222222-2222-4222-8222-222222222222",
	slug: "coimbatore-city-10k",
	addressLine2: null,
	postalCode: null,
	status: "draft",
	refundPolicy: null,
	cancellationPolicy: null,
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
} as const;

const validEventUpdate = {
	title: "Coimbatore City 10K Updated",
	description:
		"An updated paid running event for Coimbatore runners with a clearly marked city route.",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	addressLine2: "Near Arts College",
	postalCode: "641018",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Updated single-loop 10K route through Race Course Road.",
} satisfies EventUpdatePayload;

describe("createEventOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("posts the validated event payload with forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: {
				...validCreateEvent,
				id: "11111111-1111-4111-8111-111111111111",
				organizerId: "22222222-2222-4222-8222-222222222222",
				slug: "coimbatore-city-10k",
				addressLine2: null,
				postalCode: null,
				status: "draft",
				createdAt: "2026-04-26T12:00:00.000Z",
				updatedAt: "2026-04-26T12:00:00.000Z",
			},
		});

		await createEventOnServer(validCreateEvent);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith("/events", {
			method: "POST",
			body: validCreateEvent,
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});

	it("does not forward the mutation when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(createEventOnServer(validCreateEvent)).rejects.toThrow(
			"Invalid request origin",
		);

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});

describe("getEventOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("fetches an event with forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: eventResponse,
		});

		await getEventOnServer(eventId);

		expect(assertSameOriginMutationRequest).not.toHaveBeenCalled();
		expect(serverApiClient).toHaveBeenCalledWith(`/events/${eventId}`, {
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});
});

describe("updateEventOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("puts editable event fields with same-origin validation and auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: {
				...eventResponse,
				...validEventUpdate,
			},
		});

		await updateEventOnServer(eventId, validEventUpdate);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(`/events/${eventId}`, {
			method: "PUT",
			body: validEventUpdate,
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});

	it("does not forward the update when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(
			updateEventOnServer(eventId, validEventUpdate),
		).rejects.toThrow("Invalid request origin");

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});

describe("listEventCategoriesOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("fetches event categories with forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { categories: categoryRecords },
		});

		await listEventCategoriesOnServer(eventId);

		expect(assertSameOriginMutationRequest).not.toHaveBeenCalled();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/categories`,
			{
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});
});

describe("replaceEventCategoriesOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("puts the category config with same-origin validation and auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { categories: categoryRecords },
		});

		await replaceEventCategoriesOnServer(eventId, validCategoryConfig);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/categories`,
			{
				method: "PUT",
				body: validCategoryConfig,
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});

	it("does not forward the update when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(
			replaceEventCategoriesOnServer(eventId, validCategoryConfig),
		).rejects.toThrow("Invalid request origin");

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});

describe("listEventPricingOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("fetches event pricing with forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { tiers: pricingTiers },
		});

		await listEventPricingOnServer(eventId);

		expect(assertSameOriginMutationRequest).not.toHaveBeenCalled();
		expect(serverApiClient).toHaveBeenCalledWith(`/events/${eventId}/pricing`, {
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});
});

describe("replaceEventPricingOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("puts the pricing config with same-origin validation and auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { tiers: pricingTiers },
		});

		await replaceEventPricingOnServer(eventId, validPricingConfig);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(`/events/${eventId}/pricing`, {
			method: "PUT",
			body: validPricingConfig,
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});

	it("does not forward the update when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(
			replaceEventPricingOnServer(eventId, validPricingConfig),
		).rejects.toThrow("Invalid request origin");

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});

describe("listEventImagesOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("fetches event images with filters and forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { images: [eventImage] },
		});

		await listEventImagesOnServer(eventId, {
			kind: "hero",
			status: "uploaded",
		});

		expect(assertSameOriginMutationRequest).not.toHaveBeenCalled();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/images?kind=hero&status=uploaded`,
			{
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});
});

describe("requestEventImageUploadUrlOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("requests an image upload URL with same-origin validation", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: {
				imageId,
				url: "https://storage.example.com/upload",
				method: "PUT",
				headers: { "content-type": "image/png" },
				key: "events/event-1/hero.png",
				expiresAt: "2026-04-26T12:05:00.000Z",
			},
		});

		await requestEventImageUploadUrlOnServer(eventId, validImageUploadRequest);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/images/upload-url`,
			{
				method: "POST",
				body: validImageUploadRequest,
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});

	it("does not request an image upload URL when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(
			requestEventImageUploadUrlOnServer(eventId, validImageUploadRequest),
		).rejects.toThrow("Invalid request origin");

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});

describe("confirmEventImageUploadOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("confirms an image upload with same-origin validation", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: eventImage,
		});

		await confirmEventImageUploadOnServer(eventId, imageId);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/images/${imageId}/confirm`,
			{
				method: "POST",
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});
});

describe("deleteEventImageOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("deletes an image with same-origin validation", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: { deleted: true, imageId, kind: "hero" },
		});

		await deleteEventImageOnServer(eventId, imageId);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith(
			`/events/${eventId}/images/${imageId}`,
			{
				method: "DELETE",
				headers: {
					Cookie: "session=test-session",
					"X-Request-ID": "req-1",
				},
			},
		);
	});
});
