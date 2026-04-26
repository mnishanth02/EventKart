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
const mockListEventCategories = vi.fn();
const mockReplaceEventCategories = vi.fn();

vi.mock("../../../src/modules/events/service.js", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../../src/modules/events/service.js")
		>();
	return {
		...actual,
		createDraftEvent: (...args: unknown[]) => mockCreateDraftEvent(...args),
		listEventCategories: (...args: unknown[]) =>
			mockListEventCategories(...args),
		replaceEventCategories: (...args: unknown[]) =>
			mockReplaceEventCategories(...args),
	};
});

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

const mockCategories = [
	{
		id: TEST_CATEGORY_5K_ID,
		eventId: TEST_EVENT_ID,
		name: "5K",
		slug: "5k",
		distanceMeters: 5000,
		sortOrder: 0,
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
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	},
];

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
