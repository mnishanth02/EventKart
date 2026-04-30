import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const mockCreateDraftEvent = vi.fn();
const mockGetEvent = vi.fn();
const mockUpdateDraftEvent = vi.fn();
const mockListEventPricing = vi.fn();
const mockListEventCategories = vi.fn();
const mockGetEventPolicies = vi.fn();
const mockUpdateEventPolicies = vi.fn();
const mockGetEventRegistrationForm = vi.fn();
const mockUpdateEventRegistrationForm = vi.fn();
const mockReplaceEventPricing = vi.fn();
const mockReplaceEventCategories = vi.fn();
const mockRequestEventImageUpload = vi.fn();
const mockConfirmEventImageUpload = vi.fn();
const mockListEventImages = vi.fn();
const mockDeleteEventImage = vi.fn();
const mockGetPublishReadiness = vi.fn();
const mockPublishEvent = vi.fn();
const mockUnpublishEvent = vi.fn();
const mockUpdatePublishedEvent = vi.fn();
const mockUpdateEventCategoryCapacity = vi.fn();
const mockListPublicEvents = vi.fn();

vi.mock("../../../src/modules/events/service.js", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../../src/modules/events/service.js")
		>();
	return {
		...actual,
		createDraftEvent: (...args: unknown[]) => mockCreateDraftEvent(...args),
		getEvent: (...args: unknown[]) => mockGetEvent(...args),
		updateDraftEvent: (...args: unknown[]) => mockUpdateDraftEvent(...args),
		getEventPolicies: (...args: unknown[]) => mockGetEventPolicies(...args),
		getPublishReadiness: (...args: unknown[]) =>
			mockGetPublishReadiness(...args),
		publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
		unpublishEvent: (...args: unknown[]) => mockUnpublishEvent(...args),
		updatePublishedEvent: (...args: unknown[]) =>
			mockUpdatePublishedEvent(...args),
		updateEventCategoryCapacity: (...args: unknown[]) =>
			mockUpdateEventCategoryCapacity(...args),
		listEventPricing: (...args: unknown[]) => mockListEventPricing(...args),
		listEventCategories: (...args: unknown[]) =>
			mockListEventCategories(...args),
		updateEventPolicies: (...args: unknown[]) =>
			mockUpdateEventPolicies(...args),
		getEventRegistrationForm: (...args: unknown[]) =>
			mockGetEventRegistrationForm(...args),
		updateEventRegistrationForm: (...args: unknown[]) =>
			mockUpdateEventRegistrationForm(...args),
		replaceEventPricing: (...args: unknown[]) =>
			mockReplaceEventPricing(...args),
		replaceEventCategories: (...args: unknown[]) =>
			mockReplaceEventCategories(...args),
	};
});

vi.mock("../../../src/modules/events/event-image-service.js", () => ({
	requestEventImageUpload: (...args: unknown[]) =>
		mockRequestEventImageUpload(...args),
	confirmEventImageUpload: (...args: unknown[]) =>
		mockConfirmEventImageUpload(...args),
	listEventImages: (...args: unknown[]) => mockListEventImages(...args),
	deleteEventImage: (...args: unknown[]) => mockDeleteEventImage(...args),
}));

vi.mock("../../../src/modules/events/public-listing-service.js", () => ({
	listPublicEvents: (...args: unknown[]) => mockListPublicEvents(...args),
}));

import {
	defaultEventRegistrationFormSchema,
	eventRegistrationFormSchema,
} from "@repo/shared/schemas";
import type { FastifyInstance } from "fastify";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../src/lib/errors.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

const EVENTS_URL = "/api/v1/events";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_IMAGE_ID = "12121212-1212-4121-8121-121212121212";
const TEST_CATEGORY_5K_ID = "22222222-2222-4222-8222-222222222222";
const TEST_CATEGORY_10K_ID = "33333333-3333-4333-8333-333333333333";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const validCreateEventBody = {
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

const validUpdateEventBody = {
	...validCreateEventBody,
	title: "Updated Coimbatore City 10K",
	description:
		"Updated paid running event for Coimbatore runners with clearer route and venue details.",
	venueName: "VOC Park Grounds",
	addressLine1: "VOC Park, Gopalapuram",
	addressLine2: "Gate 2",
	postalCode: "641018",
	routeDetails: "Updated single-loop 10K route through Race Course Road.",
};

const mockEvent = {
	id: TEST_EVENT_ID,
	organizerId: TEST_ORGANIZER_ID,
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
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
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
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
};

const validCategoriesBody = {
	categories: [
		{
			name: "5K",
			slug: "5k",
			distanceMeters: 5000,
			sortOrder: 0,
		},
		{
			name: "10K",
			slug: "10k",
			distanceMeters: 10000,
			sortOrder: 1,
		},
	],
};

const validPricingBody = {
	tiers: [
		{
			eventCategoryId: TEST_CATEGORY_5K_ID,
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		},
		{
			eventCategoryId: TEST_CATEGORY_10K_ID,
			basePrice: 1499,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
		},
	],
};

const validPoliciesBody = {
	refundPolicy:
		"Refunds are available until seven days before race day, less payment gateway fees.",
	cancellationPolicy:
		"If the event is cancelled by the organizer, registered participants receive a full refund.",
};

const validImageUploadBody = {
	kind: "hero",
	fileName: "hero.jpg",
	contentType: "image/jpeg",
	sizeBytes: 1_024_000,
};

const mockEventImage = {
	id: TEST_IMAGE_ID,
	eventId: TEST_EVENT_ID,
	kind: "hero",
	fileName: "hero.jpg",
	contentType: "image/jpeg",
	sizeBytes: 1_024_000,
	storageKey: `events/images/${TEST_EVENT_ID}/hero.jpg`,
	status: "uploaded",
	uploadedBy: TEST_USER_ID,
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
};

const mockImageUploadUrl = {
	imageId: TEST_IMAGE_ID,
	url: "https://s3.example.com/event-image-upload",
	method: "POST" as const,
	fields: { "Content-Type": "image/jpeg" },
	key: `events/images/${TEST_EVENT_ID}/hero.jpg`,
	expiresAt: "2026-04-26T12:15:00.000Z",
};

const mockPolicies = {
	eventId: TEST_EVENT_ID,
	...validPoliciesBody,
	updatedAt: "2026-04-26T12:00:00.000Z",
};

const validRegistrationFormBody = eventRegistrationFormSchema.parse({
	...defaultEventRegistrationFormSchema,
	fields: defaultEventRegistrationFormSchema.fields.map((field) =>
		field.fieldId === "blood_group"
			? {
					...field,
					enabled: true,
					required: true,
					safetyCritical: true,
					safetyCriticalReason:
						"Blood group helps on-site medical staff during emergencies.",
				}
			: field,
	),
});

const mockRegistrationForm = {
	eventId: TEST_EVENT_ID,
	formSchema: validRegistrationFormBody,
	formSchemaVersion: validRegistrationFormBody.version,
	updatedAt: "2026-04-26T12:00:00.000Z",
};

const mockCategories = [
	{
		id: TEST_CATEGORY_5K_ID,
		eventId: TEST_EVENT_ID,
		name: "5K",
		slug: "5k",
		distanceMeters: 5000,
		sortOrder: 0,
		spotsTotal: 100,
		spotsRemaining: 100,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	},
	{
		id: TEST_CATEGORY_10K_ID,
		eventId: TEST_EVENT_ID,
		name: "10K",
		slug: "10k",
		distanceMeters: 10000,
		sortOrder: 1,
		spotsTotal: 100,
		spotsRemaining: 100,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	},
];

const mockPricingTiers = [
	{
		id: "44444444-4444-4444-8444-444444444444",
		eventId: TEST_EVENT_ID,
		eventCategoryId: TEST_CATEGORY_5K_ID,
		basePrice: 999,
		earlyBirdPrice: 799,
		earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
		category: mockCategories[0],
	},
	{
		id: "55555555-5555-4555-8555-555555555555",
		eventId: TEST_EVENT_ID,
		eventCategoryId: TEST_CATEGORY_10K_ID,
		basePrice: 1499,
		earlyBirdPrice: null,
		earlyBirdDeadline: null,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
		category: mockCategories[1],
	},
];

const mockPublishReadiness = {
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

const mockPublicEventCard = {
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	timezone: "Asia/Kolkata",
	city: "Coimbatore",
	venueName: "Race Course Grounds",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	isPaid: true,
	heroImage: null,
	categories: [
		{
			name: "10K",
			slug: "10k",
			distanceMeters: 10000,
			capacity: null,
		},
	],
	pricingTiers: [
		{
			categorySlug: "10k",
			basePrice: 129900,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
			currency: "INR",
		},
	],
};

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupOrganizerSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_USER_ID,
			role: "organizer",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
}

function setupParticipantSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_USER_ID,
			role: "participant",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
}

function buildCsrfHeaders() {
	const csrfToken = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
	return {
		cookies: {
			[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
			[CSRF_COOKIE_NAME]: csrfToken,
		},
		headers: {
			[CSRF_HEADER_NAME]: csrfToken,
		},
	};
}

function enableStorage(app: FastifyInstance) {
	Object.assign(app.storage, { enabled: true });
}

describe("POST /api/v1/events", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockCreateDraftEvent.mockReset();
	});

	it("returns 201 with a draft event for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockCreateDraftEvent.mockResolvedValue(mockEvent);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({ success: true, data: mockEvent });
		expect(mockCreateDraftEvent).toHaveBeenCalledOnce();
		const [_deps, userId, body] = mockCreateDraftEvent.mock.calls[0] as [
			unknown,
			string,
			Record<string, unknown>,
		];
		expect(userId).toBe(TEST_USER_ID);
		expect(body).toMatchObject({
			title: "Coimbatore City 10K",
			city: "Coimbatore",
			isPaid: true,
			currency: "INR",
		});
	});

	it("returns a service-generated suffixed slug when the base slug conflicts", async () => {
		setupOrganizerSession(app);
		mockCreateDraftEvent.mockResolvedValue({
			...mockEvent,
			slug: "coimbatore-city-10k-2",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(201);
		expect(response.json().data.slug).toBe("coimbatore-city-10k-2");
	});

	it("returns 401 when no session cookie is provided", async () => {
		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockCreateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 403 when an authenticated participant creates an event", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockCreateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 404 when the organizer profile is missing", async () => {
		setupOrganizerSession(app);
		mockCreateDraftEvent.mockRejectedValue(
			new NotFoundError("Organizer profile not found. Please register first."),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it.each([
		["city", { city: "Chennai" }],
		["type", { eventType: "workshop" }],
		["payment", { isPaid: false }],
	])("returns 400 for invalid V1 %s constraints", async (_name, override) => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: { ...validCreateEventBody, ...override },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockCreateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 400 for invalid date constraints from shared validation", async () => {
		setupOrganizerSession(app);
		mockCreateDraftEvent.mockRejectedValue(
			new ValidationError("Invalid event details", {
				issues: [
					{
						code: "custom",
						message: "Event end time must be after the start time",
						path: ["endAt"],
					},
				],
			}),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			...csrf,
			payload: {
				...validCreateEventBody,
				startAt: "2026-08-15T03:30:00.000Z",
				endAt: "2026-08-15T00:30:00.000Z",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
	});

	it("returns 403 and does not call service when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "POST",
			url: EVENTS_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validCreateEventBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockCreateDraftEvent).not.toHaveBeenCalled();
	});
});

describe("GET /api/v1/events/public", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockListPublicEvents.mockReset();
	});

	it("returns 200 with the listing handler envelope before /:eventId can match public", async () => {
		mockListPublicEvents.mockResolvedValue({
			data: [mockPublicEventCard],
			meta: {
				page: 1,
				limit: 20,
				total: 1,
				totalPages: 1,
				hasNext: false,
				hasPrev: false,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/public`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: [mockPublicEventCard],
			meta: {
				page: 1,
				limit: 20,
				total: 1,
				totalPages: 1,
				hasNext: false,
				hasPrev: false,
			},
		});
		expect(mockListPublicEvents).toHaveBeenCalledOnce();
	});

	it("passes parsed query params and a route-created now Date to the service", async () => {
		mockListPublicEvents.mockResolvedValue({
			data: [],
			meta: {
				page: 2,
				limit: 5,
				total: 5,
				totalPages: 1,
				hasNext: false,
				hasPrev: true,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/public?page=2&limit=5&sort=startAtAsc`,
		});

		expect(response.statusCode).toBe(200);
		const [_deps, params] = mockListPublicEvents.mock.calls[0] as [
			unknown,
			{ page: number; limit: number; sort: string; now: Date },
		];
		expect(params).toMatchObject({ page: 2, limit: 5, sort: "startAtAsc" });
		expect(params.now).toBeInstanceOf(Date);
	});

	it("accepts descending sort with pagination params", async () => {
		mockListPublicEvents.mockResolvedValue({
			data: [],
			meta: {
				page: 2,
				limit: 10,
				total: 15,
				totalPages: 2,
				hasNext: false,
				hasPrev: true,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/public?sort=startAtDesc&page=2&limit=10`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			meta: {
				page: 2,
				limit: 10,
			},
		});
	});

	it.each([
		"limit=999",
		"sort=hax",
	])("returns 400 for invalid query %s", async (query) => {
		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/public?${query}`,
		});

		expect(response.statusCode).toBe(400);
		expect(mockListPublicEvents).not.toHaveBeenCalled();
	});

	it("returns deterministic empty-list pagination metadata", async () => {
		mockListPublicEvents.mockResolvedValue({
			data: [],
			meta: {
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/public`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			data: [],
			meta: {
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		});
	});
});

describe("GET /api/v1/events/:eventId", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockGetEvent.mockReset();
	});

	it("returns a publicly readable event without requiring auth", async () => {
		mockGetEvent.mockResolvedValue(mockEvent);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ success: true, data: mockEvent });
		expect(mockGetEvent).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			undefined,
		);
	});

	it("passes organizer user id so draft events owned by the organizer are readable", async () => {
		setupOrganizerSession(app);
		mockGetEvent.mockResolvedValue(mockEvent);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockGetEvent).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_USER_ID,
		);
	});

	it("returns 404 when the event is not readable", async () => {
		mockGetEvent.mockRejectedValue(new NotFoundError("Event not found"));

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns 400 for an invalid event id", async () => {
		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/not-a-uuid`,
		});

		expect(response.statusCode).toBe(400);
		expect(mockGetEvent).not.toHaveBeenCalled();
	});
});

describe("event publish workflow routes", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockGetPublishReadiness.mockReset();
		mockPublishEvent.mockReset();
		mockUnpublishEvent.mockReset();
		mockUpdatePublishedEvent.mockReset();
	});

	it("returns publish readiness for an authenticated organizer without CSRF", async () => {
		setupOrganizerSession(app);
		mockGetPublishReadiness.mockResolvedValue(mockPublishReadiness);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/publish-readiness`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockPublishReadiness,
		});
		expect(mockGetPublishReadiness).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
		);
	});

	it("publishes an event when CSRF token is present", async () => {
		setupOrganizerSession(app);
		const publishedEvent = {
			...mockEvent,
			status: "published",
			publishedAt: "2026-04-26T12:05:00.000Z",
		};
		mockPublishEvent.mockResolvedValue({
			event: publishedEvent,
			transition: "draft_to_published",
			readiness: mockPublishReadiness,
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/publish`,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			data: {
				event: publishedEvent,
				transition: "draft_to_published",
			},
		});
		expect(mockPublishEvent).toHaveBeenCalledOnce();
	});

	it("requires CSRF for publish", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/publish`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockPublishEvent).not.toHaveBeenCalled();
	});

	it("unpublishes an event when CSRF token is present", async () => {
		setupOrganizerSession(app);
		mockUnpublishEvent.mockResolvedValue({
			event: mockEvent,
			transition: "published_to_draft",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/unpublish`,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			data: {
				event: mockEvent,
				transition: "published_to_draft",
			},
		});
		expect(mockUnpublishEvent).toHaveBeenCalledOnce();
	});

	it("requires CSRF for unpublish", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/unpublish`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockUnpublishEvent).not.toHaveBeenCalled();
	});
});

describe("PUT /api/v1/events/:eventId", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockUpdateDraftEvent.mockReset();
	});

	it("updates draft event details for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockUpdateDraftEvent.mockResolvedValue({
			...mockEvent,
			...validUpdateEventBody,
			slug: "updated-coimbatore-city-10k",
			updatedAt: "2026-04-27T12:00:00.000Z",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			data: {
				id: TEST_EVENT_ID,
				title: "Updated Coimbatore City 10K",
				slug: "updated-coimbatore-city-10k",
			},
		});
		expect(mockUpdateDraftEvent).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockUpdateDraftEvent.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validUpdateEventBody);
	});

	it("returns 401 when no session cookie is provided", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockUpdateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 403 when an authenticated participant updates an event", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockUpdateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 403 and does not call service when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockUpdateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 403 when the organizer does not own the event", async () => {
		setupOrganizerSession(app);
		mockUpdateDraftEvent.mockRejectedValue(
			new ForbiddenError("You do not have access to this event"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "FORBIDDEN" },
		});
	});

	it("returns 409 when the event is not draft", async () => {
		setupOrganizerSession(app);
		mockUpdateDraftEvent.mockRejectedValue(
			new ConflictError(
				"Event details can only be updated while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload: validUpdateEventBody,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it.each([
		[
			"invalid date order",
			{
				startAt: "2026-08-15T03:30:00.000Z",
				endAt: "2026-08-15T00:30:00.000Z",
			},
		],
		["immutable field", { city: "Coimbatore" }],
		["missing title", { title: undefined }],
	])("returns 400 for %s", async (_name, override) => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();
		const payload = { ...validUpdateEventBody, ...override };

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockUpdateDraftEvent).not.toHaveBeenCalled();
	});

	it("returns 400 for an empty update payload", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockUpdateDraftEvent).not.toHaveBeenCalled();
	});
});

describe("GET /api/v1/events/:eventId/categories", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockListEventCategories.mockReset();
	});

	it("returns event categories without requiring authentication", async () => {
		mockListEventCategories.mockResolvedValue(mockCategories);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { categories: mockCategories },
		});
		expect(mockListEventCategories).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			undefined,
		);
	});

	it("passes organizer identity for authenticated draft reads", async () => {
		setupOrganizerSession(app);
		mockListEventCategories.mockResolvedValue(mockCategories);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockListEventCategories).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_USER_ID,
		);
	});

	it("returns 404 when the event is missing", async () => {
		mockListEventCategories.mockRejectedValue(
			new NotFoundError("Event not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

describe("PUT /api/v1/events/:eventId/categories", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockReplaceEventCategories.mockReset();
	});

	it("replaces categories for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockReplaceEventCategories.mockResolvedValue(mockCategories);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { categories: mockCategories },
		});
		expect(mockReplaceEventCategories).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockReplaceEventCategories.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validCategoriesBody);
	});

	it("returns 401 when no session cookie is provided", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockReplaceEventCategories).not.toHaveBeenCalled();
	});

	it("returns 403 when an authenticated participant replaces categories", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockReplaceEventCategories).not.toHaveBeenCalled();
	});

	it("returns 403 and does not call service when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockReplaceEventCategories).not.toHaveBeenCalled();
	});

	it("returns 403 when the organizer does not own the event", async () => {
		setupOrganizerSession(app);
		mockReplaceEventCategories.mockRejectedValue(
			new ForbiddenError("You do not have access to this event"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "FORBIDDEN" },
		});
	});

	it("returns 404 when the event is missing", async () => {
		setupOrganizerSession(app);
		mockReplaceEventCategories.mockRejectedValue(
			new NotFoundError("Event not found"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns 409 when the event is not draft", async () => {
		setupOrganizerSession(app);
		mockReplaceEventCategories.mockRejectedValue(
			new ConflictError(
				"Event categories can only be updated while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload: validCategoriesBody,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it.each([
		["empty category array", { categories: [] }],
		[
			"duplicate slugs",
			{
				categories: [
					{
						name: "5K",
						slug: "5k",
						distanceMeters: 5000,
						sortOrder: 0,
					},
					{
						name: "Five Kilometres",
						slug: "5k",
						distanceMeters: 5000,
						sortOrder: 1,
					},
				],
			},
		],
		[
			"invalid distance",
			{
				categories: [
					{
						name: "5K",
						slug: "5k",
						distanceMeters: 0,
						sortOrder: 0,
					},
				],
			},
		],
	])("returns 400 for %s", async (_name, payload) => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories`,
			...csrf,
			payload,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockReplaceEventCategories).not.toHaveBeenCalled();
	});
});

describe("PATCH /api/v1/events/:eventId/categories/:categoryId/capacity", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockUpdateEventCategoryCapacity.mockReset();
	});

	it("patches category capacity for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		const updatedCategory = {
			id: TEST_CATEGORY_5K_ID,
			eventId: TEST_EVENT_ID,
			name: "5K",
			slug: "5k",
			distanceMeters: 5000,
			sortOrder: 0,
			spotsTotal: 150,
			spotsRemaining: 125,
			createdAt: "2026-04-26T12:00:00.000Z",
			updatedAt: "2026-04-26T12:05:00.000Z",
		};
		mockUpdateEventCategoryCapacity.mockResolvedValue(updatedCategory);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories/${TEST_CATEGORY_5K_ID}/capacity`,
			...csrf,
			payload: { spotsRemaining: 125 },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: updatedCategory,
		});
		expect(mockUpdateEventCategoryCapacity).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
			TEST_CATEGORY_5K_ID,
			{ spotsRemaining: 125 },
		);
	});

	it("does not accept PUT for partial capacity updates", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/categories/${TEST_CATEGORY_5K_ID}/capacity`,
			...csrf,
			payload: { spotsRemaining: 125 },
		});

		expect(response.statusCode).toBe(404);
		expect(mockUpdateEventCategoryCapacity).not.toHaveBeenCalled();
	});
});

describe("GET /api/v1/events/:eventId/policies", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockGetEventPolicies.mockReset();
	});

	it("returns event policies without requiring authentication", async () => {
		mockGetEventPolicies.mockResolvedValue(mockPolicies);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockPolicies,
		});
		expect(mockGetEventPolicies).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			undefined,
		);
	});

	it("passes organizer identity for authenticated draft policy reads", async () => {
		setupOrganizerSession(app);
		mockGetEventPolicies.mockResolvedValue(mockPolicies);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockGetEventPolicies).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_USER_ID,
		);
	});

	it("returns nullable policy fields for draft events without saved policies", async () => {
		mockGetEventPolicies.mockResolvedValue({
			eventId: TEST_EVENT_ID,
			refundPolicy: null,
			cancellationPolicy: null,
			updatedAt: "2026-04-26T12:00:00.000Z",
		});

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data.refundPolicy).toBeNull();
		expect(response.json().data.cancellationPolicy).toBeNull();
	});

	it("returns 404 when the event is missing", async () => {
		mockGetEventPolicies.mockRejectedValue(
			new NotFoundError("Event not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

describe("PUT /api/v1/events/:eventId/policies", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockUpdateEventPolicies.mockReset();
	});

	it("updates policies for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockUpdateEventPolicies.mockResolvedValue(mockPolicies);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			...csrf,
			payload: validPoliciesBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockPolicies,
		});
		expect(mockUpdateEventPolicies).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockUpdateEventPolicies.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validPoliciesBody);
	});

	it("returns 401 when no session cookie is provided", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			payload: validPoliciesBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockUpdateEventPolicies).not.toHaveBeenCalled();
	});

	it("returns 403 when an authenticated participant updates policies", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			...csrf,
			payload: validPoliciesBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockUpdateEventPolicies).not.toHaveBeenCalled();
	});

	it("returns 403 and does not call service when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validPoliciesBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockUpdateEventPolicies).not.toHaveBeenCalled();
	});

	it("returns 409 when the event is not draft", async () => {
		setupOrganizerSession(app);
		mockUpdateEventPolicies.mockRejectedValue(
			new ConflictError(
				"Event policies can only be updated while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			...csrf,
			payload: validPoliciesBody,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it.each([
		["blank refund policy", { ...validPoliciesBody, refundPolicy: "   " }],
		[
			"blank cancellation policy",
			{ ...validPoliciesBody, cancellationPolicy: "   " },
		],
	])("returns 400 for %s", async (_name, payload) => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/policies`,
			...csrf,
			payload,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockUpdateEventPolicies).not.toHaveBeenCalled();
	});
});

describe("event registration form routes", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockGetEventRegistrationForm.mockReset();
		mockUpdateEventRegistrationForm.mockReset();
	});

	it("returns the registration form for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockGetEventRegistrationForm.mockResolvedValue(mockRegistrationForm);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockRegistrationForm,
		});
		expect(mockGetEventRegistrationForm).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
		);
	});

	it("returns 401 when reading without a session", async () => {
		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockGetEventRegistrationForm).not.toHaveBeenCalled();
	});

	it("updates the registration form for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockUpdateEventRegistrationForm.mockResolvedValue(mockRegistrationForm);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			...csrf,
			payload: validRegistrationFormBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockRegistrationForm,
		});
		expect(mockUpdateEventRegistrationForm).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockUpdateEventRegistrationForm.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validRegistrationFormBody);
	});

	it("rejects sensitive required fields without a safety-critical reason through shared validation", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();
		const payload = {
			...defaultEventRegistrationFormSchema,
			fields: defaultEventRegistrationFormSchema.fields.map((field) =>
				field.fieldId === "date_of_birth"
					? { ...field, enabled: true, required: true }
					: field,
			),
		};

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			...csrf,
			payload,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockUpdateEventRegistrationForm).not.toHaveBeenCalled();
	});

	it("returns 403 when another organizer cannot access the form", async () => {
		setupOrganizerSession(app);
		mockGetEventRegistrationForm.mockRejectedValue(
			new ForbiddenError("You do not have access to this event"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "FORBIDDEN" },
		});
	});

	it("requires CSRF for registration form updates", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validRegistrationFormBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockUpdateEventRegistrationForm).not.toHaveBeenCalled();
	});

	it("returns 409 when updating a published event registration form", async () => {
		setupOrganizerSession(app);
		mockUpdateEventRegistrationForm.mockRejectedValue(
			new ConflictError(
				"Event registration form can only be updated while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/registration-form`,
			...csrf,
			payload: validRegistrationFormBody,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});
});

describe("GET /api/v1/events/:eventId/pricing", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockListEventPricing.mockReset();
	});

	it("returns event pricing without requiring authentication", async () => {
		mockListEventPricing.mockResolvedValue(mockPricingTiers);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { tiers: mockPricingTiers },
		});
		expect(mockListEventPricing).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			undefined,
		);
	});

	it("passes organizer identity for authenticated draft pricing reads", async () => {
		setupOrganizerSession(app);
		mockListEventPricing.mockResolvedValue(mockPricingTiers);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockListEventPricing).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_USER_ID,
		);
	});

	it("returns 404 when the event is missing", async () => {
		mockListEventPricing.mockRejectedValue(
			new NotFoundError("Event not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

describe("PUT /api/v1/events/:eventId/pricing", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockReplaceEventPricing.mockReset();
	});

	it("replaces pricing for an authenticated organizer", async () => {
		setupOrganizerSession(app);
		mockReplaceEventPricing.mockResolvedValue(mockPricingTiers);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			...csrf,
			payload: validPricingBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { tiers: mockPricingTiers },
		});
		expect(mockReplaceEventPricing).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockReplaceEventPricing.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validPricingBody);
	});

	it("returns 401 when no session cookie is provided", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			payload: validPricingBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
		expect(mockReplaceEventPricing).not.toHaveBeenCalled();
	});

	it("returns 403 when an authenticated participant replaces pricing", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			...csrf,
			payload: validPricingBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockReplaceEventPricing).not.toHaveBeenCalled();
	});

	it("returns 403 and does not call service when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validPricingBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockReplaceEventPricing).not.toHaveBeenCalled();
	});

	it("returns 409 when the event is not draft", async () => {
		setupOrganizerSession(app);
		mockReplaceEventPricing.mockRejectedValue(
			new ConflictError(
				"Event pricing can only be updated while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			...csrf,
			payload: validPricingBody,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it("returns 400 for invalid early-bird pricing", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PUT",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/pricing`,
			...csrf,
			payload: {
				tiers: [
					{
						eventCategoryId: TEST_CATEGORY_5K_ID,
						basePrice: 999,
						earlyBirdPrice: 999,
						earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
					},
				],
			},
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockReplaceEventPricing).not.toHaveBeenCalled();
	});
});

describe("POST /api/v1/events/:eventId/images/upload-url", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRequestEventImageUpload.mockReset();
	});

	it("returns a presigned event image upload URL for an organizer", async () => {
		setupOrganizerSession(app);
		mockRequestEventImageUpload.mockResolvedValue(mockImageUploadUrl);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			...csrf,
			payload: validImageUploadBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockImageUploadUrl,
		});
		expect(mockRequestEventImageUpload).toHaveBeenCalledOnce();
		const [_deps, userId, eventId, body] = mockRequestEventImageUpload.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(userId).toBe(TEST_USER_ID);
		expect(eventId).toBe(TEST_EVENT_ID);
		expect(body).toEqual(validImageUploadBody);
	});

	it("returns 401 without a session", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			payload: validImageUploadBody,
		});

		expect(response.statusCode).toBe(401);
		expect(mockRequestEventImageUpload).not.toHaveBeenCalled();
	});

	it("returns 403 without CSRF token", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: validImageUploadBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockRequestEventImageUpload).not.toHaveBeenCalled();
	});

	it("returns 403 for participant sessions", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			...csrf,
			payload: validImageUploadBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	it.each([
		["invalid MIME type", { contentType: "image/gif" }],
		["oversized request", { sizeBytes: 5 * 1024 * 1024 + 1 }],
	])("returns 400 for %s", async (_name, override) => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			...csrf,
			payload: { ...validImageUploadBody, ...override },
		});

		expect(response.statusCode).toBe(400);
		expect(mockRequestEventImageUpload).not.toHaveBeenCalled();
	});

	it.each([
		"published",
		"under_review",
	] as const)("returns 409 when the service rejects hero upload-url requests for %s events", async (status) => {
		setupOrganizerSession(app);
		mockRequestEventImageUpload.mockRejectedValue(
			new ConflictError(
				"Hero images can only be changed while the event is in draft status",
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			...csrf,
			payload: { ...validImageUploadBody, kind: "hero" },
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: {
				code: "CONFLICT",
				message:
					"Hero images can only be changed while the event is in draft status",
			},
		});
		expect(mockRequestEventImageUpload).toHaveBeenCalledOnce();
		const [_deps, _userId, _eventId, body] = mockRequestEventImageUpload.mock
			.calls[0] as [unknown, string, string, Record<string, unknown>];
		expect(body).toEqual({ ...validImageUploadBody, kind: "hero" });
		expect(status).toMatch(/published|under_review/);
	});
});

describe("event image routes with disabled storage", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRequestEventImageUpload.mockReset();
		Object.assign(app.storage, { enabled: false });
		setupOrganizerSession(app);
	});

	it("returns 400 when image storage is disabled", async () => {
		const csrf = buildCsrfHeaders();
		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/upload-url`,
			...csrf,
			payload: validImageUploadBody,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "VALIDATION_ERROR" },
		});
		expect(mockRequestEventImageUpload).not.toHaveBeenCalled();
	});
});

describe("POST /api/v1/events/:eventId/images/:imageId/confirm", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockConfirmEventImageUpload.mockReset();
	});

	it("confirms an uploaded image", async () => {
		setupOrganizerSession(app);
		mockConfirmEventImageUpload.mockResolvedValue(mockEventImage);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/${TEST_IMAGE_ID}/confirm`,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ success: true, data: mockEventImage });
		expect(mockConfirmEventImageUpload).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
			TEST_IMAGE_ID,
			expect.any(String),
		);
	});

	it("returns 403 without CSRF token", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/${TEST_IMAGE_ID}/confirm`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockConfirmEventImageUpload).not.toHaveBeenCalled();
	});

	it("returns 400 for invalid image id", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/not-a-uuid/confirm`,
			...csrf,
		});

		expect(response.statusCode).toBe(400);
		expect(mockConfirmEventImageUpload).not.toHaveBeenCalled();
	});

	it("returns 403 when the organizer does not own the event", async () => {
		setupOrganizerSession(app);
		mockConfirmEventImageUpload.mockRejectedValue(
			new ForbiddenError("You do not have access to this event"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/${TEST_IMAGE_ID}/confirm`,
			...csrf,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "FORBIDDEN" },
		});
	});
});

describe("GET /api/v1/events/:eventId/images", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockListEventImages.mockReset();
	});

	it("lists public uploaded images without authentication", async () => {
		mockListEventImages.mockResolvedValue([mockEventImage]);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images?kind=hero`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { images: [mockEventImage] },
		});
		expect(mockListEventImages).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			{ kind: "hero" },
			undefined,
		);
	});

	it("passes organizer identity for draft image reads", async () => {
		setupOrganizerSession(app);
		mockListEventImages.mockResolvedValue([mockEventImage]);

		const response = await app.inject({
			method: "GET",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images?status=uploaded`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockListEventImages).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			{ status: "uploaded" },
			TEST_USER_ID,
		);
	});
});

describe("DELETE /api/v1/events/:eventId/images/:imageId", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockDeleteEventImage.mockReset();
	});

	it("deletes an event image", async () => {
		setupOrganizerSession(app);
		mockDeleteEventImage.mockResolvedValue({
			deleted: true,
			imageId: TEST_IMAGE_ID,
			kind: "hero",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "DELETE",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/${TEST_IMAGE_ID}`,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { deleted: true, imageId: TEST_IMAGE_ID, kind: "hero" },
		});
		expect(mockDeleteEventImage).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
			TEST_IMAGE_ID,
			expect.any(String),
		);
	});

	it("returns 403 without CSRF token", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "DELETE",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/images/${TEST_IMAGE_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(mockDeleteEventImage).not.toHaveBeenCalled();
	});
});

describe("PATCH /api/v1/events/:eventId/published", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockUpdatePublishedEvent.mockReset();
	});

	it("patches low-risk published event fields", async () => {
		setupOrganizerSession(app);
		mockUpdatePublishedEvent.mockResolvedValue({
			...mockEvent,
			description:
				"Updated public event description that is safe for published pages.",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			...csrf,
			payload: {
				description:
					"Updated public event description that is safe for published pages.",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			success: true,
			data: {
				id: TEST_EVENT_ID,
				description:
					"Updated public event description that is safe for published pages.",
			},
		});
		expect(mockUpdatePublishedEvent).toHaveBeenCalledWith(
			expect.anything(),
			TEST_USER_ID,
			TEST_EVENT_ID,
			expect.objectContaining({ description: expect.any(String) }),
		);
	});

	it("passes mixed low-risk plus high-risk event fields through to service for structured 409", async () => {
		setupOrganizerSession(app);
		mockUpdatePublishedEvent.mockRejectedValue(
			new ConflictError(
				"High-risk fields require unpublishing the event. Unpublish first, edit in draft, then republish.",
				"PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
				{ requiresUnpublish: true, highRiskFields: ["title"] },
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			...csrf,
			payload: {
				description:
					"Updated public event description that must not be persisted.",
				title: "High Risk Title Change",
			},
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: {
				code: "PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
				details: {
					requiresUnpublish: true,
					highRiskFields: ["title"],
				},
			},
		});
	});

	it("returns 401 when unauthenticated", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			payload: { description: "Updated public event description text." },
		});

		expect(response.statusCode).toBe(401);
		expect(mockUpdatePublishedEvent).not.toHaveBeenCalled();
	});

	it("returns 403 for a non-organizer role", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			...csrf,
			payload: { description: "Updated public event description text." },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
		expect(mockUpdatePublishedEvent).not.toHaveBeenCalled();
	});

	it("returns 403 when CSRF token is missing", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: { description: "Updated public event description text." },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
		expect(mockUpdatePublishedEvent).not.toHaveBeenCalled();
	});

	it("returns 403 when the service rejects a non-owner organizer", async () => {
		setupOrganizerSession(app);
		mockUpdatePublishedEvent.mockRejectedValue(
			new ForbiddenError("You do not have access to this event"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "PATCH",
			url: `${EVENTS_URL}/${TEST_EVENT_ID}/published`,
			...csrf,
			payload: { description: "Updated public event description text." },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "FORBIDDEN" },
		});
	});
});
