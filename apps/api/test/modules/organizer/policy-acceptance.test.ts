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
const mockAcceptPolicies = vi.fn();
const mockGetPolicyStatus = vi.fn();

vi.mock("../../../src/modules/organizer/policy-service.js", () => ({
	acceptPolicies: (...args: unknown[]) => mockAcceptPolicies(...args),
	getPolicyStatus: (...args: unknown[]) => mockGetPolicyStatus(...args),
	hasAcceptedAllPolicies: vi.fn(),
}));

// Preserve existing organizer service mocks so registration routes still load
vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: vi.fn(),
	getOrganizerByUserId: vi.fn(),
	updateOrganizer: vi.fn(),
}));

import type { FastifyInstance } from "fastify";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

// ── Constants ────────────────────────────────────────────────────
const POLICIES_URL = "/api/v1/organizers/policies";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const mockPolicyStatusResponse = {
	policies: [
		{
			policyType: "platform_terms",
			currentVersion: "1.0",
			acceptedVersion: "1.0",
			isCurrentVersionAccepted: true,
			acceptedAt: "2026-04-24T00:00:00.000Z",
		},
		{
			policyType: "refund_policy",
			currentVersion: "1.0",
			acceptedVersion: "1.0",
			isCurrentVersionAccepted: true,
			acceptedAt: "2026-04-24T00:00:00.000Z",
		},
	],
	allRequiredAccepted: true,
};

const mockPolicyStatusNoneAccepted = {
	policies: [
		{
			policyType: "platform_terms",
			currentVersion: "1.0",
			acceptedVersion: null,
			isCurrentVersionAccepted: false,
			acceptedAt: null,
		},
		{
			policyType: "refund_policy",
			currentVersion: "1.0",
			acceptedVersion: null,
			isCurrentVersionAccepted: false,
			acceptedAt: null,
		},
	],
	allRequiredAccepted: false,
};

// ── Helpers ──────────────────────────────────────────────────────

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

// ── POST /api/v1/organizers/policies ─────────────────────────────

describe("POST /api/v1/organizers/policies", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockAcceptPolicies.mockReset();
		mockGetPolicyStatus.mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("successful acceptance", () => {
		it("returns 200 with policy status after acceptance", async () => {
			setupOrganizerSession(app);
			mockAcceptPolicies.mockResolvedValue(mockPolicyStatusResponse);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["platform_terms", "refund_policy"] },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: mockPolicyStatusResponse,
			});
		});

		it("calls acceptPolicies with correct args", async () => {
			setupOrganizerSession(app);
			mockAcceptPolicies.mockResolvedValue(mockPolicyStatusResponse);
			const csrf = buildCsrfHeaders();

			await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["platform_terms"] },
			});

			expect(mockAcceptPolicies).toHaveBeenCalledTimes(1);
			const [_deps, userId, policyTypes, ipAddress] = mockAcceptPolicies.mock
				.calls[0] as [unknown, string, string[], string | null];
			expect(userId).toBe(TEST_USER_ID);
			expect(policyTypes).toEqual(["platform_terms"]);
			expect(typeof ipAddress).toBe("string");
		});

		it("accepts a single policy type", async () => {
			setupOrganizerSession(app);
			mockAcceptPolicies.mockResolvedValue(mockPolicyStatusResponse);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["refund_policy"] },
			});

			expect(response.statusCode).toBe(200);
		});
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				payload: { policies: ["platform_terms"] },
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});

		it("returns 401 when session is not found in Redis", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				cookies: csrf.cookies,
				headers: csrf.headers,
				payload: { policies: ["platform_terms"] },
			});

			expect(response.statusCode).toBe(401);
		});
	});

	// ── Authorization ───────────────────────────────────────────

	describe("authorization", () => {
		it("returns 403 when user has participant role", async () => {
			setupParticipantSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["platform_terms"] },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});
	});

	// ── CSRF ────────────────────────────────────────────────────

	describe("CSRF protection", () => {
		it("returns 403 without CSRF token", async () => {
			setupOrganizerSession(app);

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
				payload: { policies: ["platform_terms"] },
			});

			expect(response.statusCode).toBe(403);
		});
	});

	// ── Validation ──────────────────────────────────────────────

	describe("validation", () => {
		it("returns 400 for empty policies array", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: [] },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for invalid policy type", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["nonexistent_policy"] },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for duplicate policy types", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["platform_terms", "platform_terms"] },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	// ── Service error propagation ───────────────────────────────

	describe("service errors", () => {
		it("propagates service errors", async () => {
			setupOrganizerSession(app);
			mockAcceptPolicies.mockRejectedValue(new Error("DB connection lost"));
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: POLICIES_URL,
				...csrf,
				payload: { policies: ["platform_terms"] },
			});

			expect(response.statusCode).toBe(500);
		});
	});
});

// ── GET /api/v1/organizers/policies ──────────────────────────────

describe("GET /api/v1/organizers/policies", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockAcceptPolicies.mockReset();
		mockGetPolicyStatus.mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("returns policy status", () => {
		it("returns 200 with all policies accepted", async () => {
			setupOrganizerSession(app);
			mockGetPolicyStatus.mockResolvedValue(mockPolicyStatusResponse);

			const response = await app.inject({
				method: "GET",
				url: POLICIES_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: mockPolicyStatusResponse,
			});
		});

		it("returns status even when no policies accepted yet", async () => {
			setupOrganizerSession(app);
			mockGetPolicyStatus.mockResolvedValue(mockPolicyStatusNoneAccepted);

			const response = await app.inject({
				method: "GET",
				url: POLICIES_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: mockPolicyStatusNoneAccepted,
			});
			expect(response.json().data.allRequiredAccepted).toBe(false);
		});

		it("calls getPolicyStatus with correct userId", async () => {
			setupOrganizerSession(app);
			mockGetPolicyStatus.mockResolvedValue(mockPolicyStatusResponse);

			await app.inject({
				method: "GET",
				url: POLICIES_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(mockGetPolicyStatus).toHaveBeenCalledTimes(1);
			const [_db, userId] = mockGetPolicyStatus.mock.calls[0] as [
				unknown,
				string,
			];
			expect(userId).toBe(TEST_USER_ID);
		});
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "GET",
				url: POLICIES_URL,
			});

			expect(response.statusCode).toBe(401);
		});
	});

	// ── Authorization ───────────────────────────────────────────

	describe("authorization", () => {
		it("returns 403 when user has participant role", async () => {
			setupParticipantSession(app);

			const response = await app.inject({
				method: "GET",
				url: POLICIES_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
		});
	});
});
