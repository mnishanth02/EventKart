import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// ── Service mocks ────────────────────────────────────────────────
const mockRetryRazorpayAccount = vi.fn();
const mockListVerifications = vi.fn();
const mockGetVerificationDetail = vi.fn();
const mockGetDocumentViewUrl = vi.fn();
const mockApproveOrganizer = vi.fn();
const mockRejectOrganizer = vi.fn();

vi.mock("../../../src/modules/admin/verification-service.js", () => ({
	listVerifications: (...args: unknown[]) => mockListVerifications(...args),
	getVerificationDetail: (...args: unknown[]) =>
		mockGetVerificationDetail(...args),
	getDocumentViewUrl: (...args: unknown[]) => mockGetDocumentViewUrl(...args),
	approveOrganizer: (...args: unknown[]) => mockApproveOrganizer(...args),
	rejectOrganizer: (...args: unknown[]) => mockRejectOrganizer(...args),
	retryRazorpayAccount: (...args: unknown[]) =>
		mockRetryRazorpayAccount(...args),
}));

import type { FastifyInstance } from "fastify";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

// ── Constants ────────────────────────────────────────────────────
const BASE_URL = "/api/v1/admin/verifications";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_ADMIN_ID = "aa0e8400-e29b-41d4-a716-446655440001";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "bb0e8400-e29b-41d4-a716-446655440010";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

// ── Helpers ──────────────────────────────────────────────────────

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

// ── Tests: POST .../retry-razorpay ──────────────────────────────

describe("POST /api/v1/admin/verifications/:organizerId/retry-razorpay", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRetryRazorpayAccount.mockReset();
	});

	it("successfully retries Razorpay account creation", async () => {
		setupAdminSession(app);
		mockRetryRazorpayAccount.mockResolvedValue({
			organizerId: TEST_ORGANIZER_ID,
			razorpayAccountStatus: "failed",
			message: "Razorpay account creation retry has been enqueued",
		});
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data.organizerId).toBe(TEST_ORGANIZER_ID);
		expect(body.data.razorpayAccountStatus).toBe("failed");
		expect(body.data.message).toContain("enqueued");
	});

	it("passes correct arguments to service", async () => {
		setupAdminSession(app);
		mockRetryRazorpayAccount.mockResolvedValue({
			organizerId: TEST_ORGANIZER_ID,
			razorpayAccountStatus: "not_started",
			message: "Razorpay account creation retry has been enqueued",
		});
		const csrf = buildCsrfHeaders();

		await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			...csrf,
			payload: {},
		});

		expect(mockRetryRazorpayAccount).toHaveBeenCalledTimes(1);
		const callArgs = mockRetryRazorpayAccount.mock.calls[0] as unknown[];
		// args: db, log, organizerId, queues, adminUserId, ipAddress
		expect(callArgs[2]).toBe(TEST_ORGANIZER_ID);
		expect(callArgs[4]).toBe(TEST_ADMIN_ID);
	});

	it("returns 404 for non-existent organizer", async () => {
		setupAdminSession(app);
		const { NotFoundError } = await import("../../../src/lib/errors.js");
		mockRetryRazorpayAccount.mockRejectedValue(
			new NotFoundError("Organizer not found"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns 409 when organizer status is not retryable", async () => {
		setupAdminSession(app);
		const { ConflictError } = await import("../../../src/lib/errors.js");
		mockRetryRazorpayAccount.mockRejectedValue(
			new ConflictError(
				'Cannot retry Razorpay account creation — current status is "active"',
			),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it("requires CSRF token", async () => {
		setupAdminSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: {},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
	});

	it("returns 403 for non-admin users", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	it("returns 401 when unauthenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/retry-razorpay`,
			payload: {},
		});

		expect(response.statusCode).toBe(401);
	});
});
