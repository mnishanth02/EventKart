import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const mockListEventReviews = vi.fn();
const mockGetEventReviewDetail = vi.fn();
const mockApproveEventReview = vi.fn();
const mockRejectEventReview = vi.fn();

vi.mock("../../../src/modules/admin/event-review-service.js", () => ({
	listEventReviews: (...args: unknown[]) => mockListEventReviews(...args),
	getEventReviewDetail: (...args: unknown[]) =>
		mockGetEventReviewDetail(...args),
	approveEventReview: (...args: unknown[]) => mockApproveEventReview(...args),
	rejectEventReview: (...args: unknown[]) => mockRejectEventReview(...args),
}));

import type { FastifyInstance } from "fastify";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

const BASE_URL = "/api/v1/admin/event-reviews";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_ADMIN_ID = "aa0e8400-e29b-41d4-a716-446655440001";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const TEST_PRICING_TIER_ID = "33333333-3333-4333-8333-333333333333";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const mockEvent = {
	id: TEST_EVENT_ID,
	organizerId: TEST_ORGANIZER_ID,
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description: "A paid running event for Coimbatore runners.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road",
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
	routeDetails: "Single-loop 10K route.",
	refundPolicy: "Refunds are available until seven days before race day.",
	cancellationPolicy: "Cancelled events are fully refunded.",
	publishedAt: null,
	firstPublishedAt: null,
	submittedForReviewAt: "2026-04-26T12:00:00.000Z",
	isPaid: true,
	currency: "INR",
	status: "under_review",
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
};

const mockListResult = {
	data: [
		{
			eventId: TEST_EVENT_ID,
			organizerId: TEST_ORGANIZER_ID,
			title: "Coimbatore City 10K",
			slug: "coimbatore-city-10k",
			status: "under_review",
			startAt: "2026-08-15T00:30:00.000Z",
			submittedForReviewAt: "2026-04-26T12:00:00.000Z",
			organizerBusinessName: "CoimbatoreRunners",
			organizerContactEmail: "admin@example.com",
			previouslyPublishedPaidEventCount: 2,
		},
	],
	meta: {
		page: 1,
		limit: 20,
		total: 1,
		totalPages: 1,
		hasNext: false,
		hasPrev: false,
	},
};

const mockDetailResult = {
	event: mockEvent,
	organizer: {
		id: TEST_ORGANIZER_ID,
		userId: TEST_USER_ID,
		businessName: "CoimbatoreRunners",
		contactName: "Ramesh Kumar",
		contactEmail: "admin@example.com",
		city: "Coimbatore",
		isVerified: true,
		razorpayAccountStatus: "active",
		previouslyPublishedPaidEventCount: 2,
	},
	configuration: {
		categories: [
			{
				id: TEST_CATEGORY_ID,
				eventId: TEST_EVENT_ID,
				name: "10K",
				slug: "10k",
				distanceMeters: 10_000,
				sortOrder: 0,
				spotsTotal: 100,
				spotsRemaining: 100,
				createdAt: "2026-04-26T12:00:00.000Z",
				updatedAt: "2026-04-26T12:00:00.000Z",
			},
		],
		pricingTiers: [
			{
				id: TEST_PRICING_TIER_ID,
				eventId: TEST_EVENT_ID,
				eventCategoryId: TEST_CATEGORY_ID,
				basePrice: 50000,
				earlyBirdPrice: null,
				earlyBirdDeadline: null,
				createdAt: "2026-04-26T12:00:00.000Z",
				updatedAt: "2026-04-26T12:00:00.000Z",
				category: {
					id: TEST_CATEGORY_ID,
					eventId: TEST_EVENT_ID,
					name: "10K",
					slug: "10k",
					distanceMeters: 10_000,
					sortOrder: 0,
					spotsTotal: 100,
					spotsRemaining: 100,
					createdAt: "2026-04-26T12:00:00.000Z",
					updatedAt: "2026-04-26T12:00:00.000Z",
				},
			},
		],
		policies: {
			eventId: TEST_EVENT_ID,
			refundPolicy: mockEvent.refundPolicy,
			cancellationPolicy: mockEvent.cancellationPolicy,
			updatedAt: "2026-04-26T12:00:00.000Z",
		},
		readiness: {
			ready: true,
			eventStatus: "under_review",
			isPaid: true,
			requiresRazorpay: true,
			wouldRequireAdminReview: true,
			items: [
				{
					check: "organizer_verified",
					passed: true,
					message: "Organizer verified",
					severity: "error",
				},
			],
		},
	},
};

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupAdminSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_ADMIN_ID,
			role: "admin",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
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

describe("admin event reviews", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockListEventReviews.mockReset();
		mockGetEventReviewDetail.mockReset();
		mockApproveEventReview.mockReset();
		mockRejectEventReview.mockReset();
	});

	it("returns paginated event reviews to admins", async () => {
		setupAdminSession(app);
		mockListEventReviews.mockResolvedValue(mockListResult);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data[0].eventId).toBe(TEST_EVENT_ID);
		expect(mockListEventReviews).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ status: "under_review" }),
		);
	});

	it("blocks non-admin users from listing event reviews", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(mockListEventReviews).not.toHaveBeenCalled();
	});

	it("returns event review detail", async () => {
		setupAdminSession(app);
		mockGetEventReviewDetail.mockResolvedValue(mockDetailResult);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_EVENT_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data.event.id).toBe(TEST_EVENT_ID);
	});

	it("approves an event review with CSRF protection", async () => {
		setupAdminSession(app);
		mockApproveEventReview.mockResolvedValue({
			event: {
				...mockEvent,
				status: "published",
				publishedAt: "2026-04-26T12:30:00.000Z",
			},
			transition: "under_review_to_published",
			reviewedAt: "2026-04-26T12:30:00.000Z",
			reviewedBy: TEST_ADMIN_ID,
		});

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_EVENT_ID}/approve`,
			...buildCsrfHeaders(),
			payload: { notes: "Looks good" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data.transition).toBe("under_review_to_published");
		expect(mockApproveEventReview).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_ADMIN_ID,
			expect.any(String),
			"Looks good",
		);
	});

	it("rejects an event review with a reason", async () => {
		setupAdminSession(app);
		mockRejectEventReview.mockResolvedValue({
			event: {
				...mockEvent,
				status: "draft",
				submittedForReviewAt: "2026-04-26T12:00:00.000Z",
			},
			transition: "under_review_to_draft",
			reviewedAt: "2026-04-26T12:30:00.000Z",
			reviewedBy: TEST_ADMIN_ID,
		});

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_EVENT_ID}/reject`,
			...buildCsrfHeaders(),
			payload: { reason: "Hero image has visible sponsor issues" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data.transition).toBe("under_review_to_draft");
		expect(mockRejectEventReview).toHaveBeenCalledWith(
			expect.anything(),
			TEST_EVENT_ID,
			TEST_ADMIN_ID,
			"Hero image has visible sponsor issues",
			expect.any(String),
		);
	});

	it("rejects whitespace-only rejection reasons", async () => {
		setupAdminSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_EVENT_ID}/reject`,
			...buildCsrfHeaders(),
			payload: { reason: "          " },
		});

		expect(response.statusCode).toBe(400);
		expect(mockRejectEventReview).not.toHaveBeenCalled();
	});
});
