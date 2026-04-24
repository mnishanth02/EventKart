import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ── Service mocks ────────────────────────────────────────────────
const mockRegisterOrganizer = vi.fn();
const mockGetOrganizerByUserId = vi.fn();
const mockUpdateOrganizer = vi.fn();

vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: (...args: unknown[]) => mockRegisterOrganizer(...args),
	getOrganizerByUserId: (...args: unknown[]) => mockGetOrganizerByUserId(...args),
	updateOrganizer: (...args: unknown[]) => mockUpdateOrganizer(...args),
}));

import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../helpers/build-app.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";

// ── Constants ────────────────────────────────────────────────────
const REGISTER_URL = "/api/v1/organizers";
const ME_URL = "/api/v1/organizers/me";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const validRegistrationBody = {
	businessName: "CoimbatoreRunners",
	contactName: "Ramesh Kumar",
	contactEmail: "ramesh@coimbatorerunners.in",
	contactPhone: "+919876543210",
	city: "Coimbatore",
	description: "Premier running event organizer in Coimbatore",
	website: "https://coimbatorerunners.in",
};

const mockOrganizerProfile = {
	id: TEST_ORGANIZER_ID,
	userId: TEST_USER_ID,
	businessName: "CoimbatoreRunners",
	contactName: "Ramesh Kumar",
	contactEmail: "ramesh@coimbatorerunners.in",
	contactPhone: "+919876543210",
	city: "Coimbatore",
	description: "Premier running event organizer in Coimbatore",
	website: "https://coimbatorerunners.in",
	verificationStatus: "pending_documents",
	isVerified: false,
	submittedForReviewAt: null,
	reviewedAt: null,
	rejectionReason: null,
	createdAt: "2026-04-24T00:00:00.000Z",
	updatedAt: "2026-04-24T00:00:00.000Z",
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

// ── Tests ────────────────────────────────────────────────────────

describe("POST /api/v1/organizers", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRegisterOrganizer.mockReset();
		mockGetOrganizerByUserId.mockReset();
		mockUpdateOrganizer.mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("successful registration", () => {
		it("returns 201 with organizer profile on success", async () => {
			setupOrganizerSession(app);
			mockRegisterOrganizer.mockResolvedValue(mockOrganizerProfile);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: validRegistrationBody,
			});

			expect(response.statusCode).toBe(201);
			expect(response.json()).toEqual({
				success: true,
				data: mockOrganizerProfile,
			});
		});

		it("calls registerOrganizer with correct args", async () => {
			setupOrganizerSession(app);
			mockRegisterOrganizer.mockResolvedValue(mockOrganizerProfile);
			const csrf = buildCsrfHeaders();

			await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: validRegistrationBody,
			});

			expect(mockRegisterOrganizer).toHaveBeenCalledTimes(1);
			const [deps, userId, data] = mockRegisterOrganizer.mock.calls[0] as [
				unknown,
				string,
				unknown,
			];
			expect(userId).toBe(TEST_USER_ID);
			expect(data).toMatchObject({
				businessName: "CoimbatoreRunners",
				contactName: "Ramesh Kumar",
				city: "Coimbatore",
			});
		});

		it("accepts registration without optional fields", async () => {
			setupOrganizerSession(app);
			const profileWithoutOptionals = {
				...mockOrganizerProfile,
				description: null,
				website: null,
			};
			mockRegisterOrganizer.mockResolvedValue(profileWithoutOptionals);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: {
					businessName: "CoimbatoreRunners",
					contactName: "Ramesh Kumar",
					contactEmail: "ramesh@coimbatorerunners.in",
					contactPhone: "+919876543210",
					city: "Coimbatore",
				},
			});

			expect(response.statusCode).toBe(201);
		});
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				payload: validRegistrationBody,
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
				url: REGISTER_URL,
				cookies: csrf.cookies,
				headers: csrf.headers,
				payload: validRegistrationBody,
			});

			expect(response.statusCode).toBe(401);
		});
	});

	// ── Authorization ───────────────────────────────────────────

	describe("authorization", () => {
		it("returns 403 when user has participant role (below organizer)", async () => {
			setupParticipantSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: validRegistrationBody,
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});
	});

	// ── Validation ──────────────────────────────────────────────

	describe("validation", () => {
		it("returns 400 when businessName is missing", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: { ...validRegistrationBody, businessName: undefined },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when contactEmail is invalid", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: { ...validRegistrationBody, contactEmail: "not-an-email" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when city is too short", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: { ...validRegistrationBody, city: "X" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when website is not a valid URL", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: { ...validRegistrationBody, website: "not-a-url" },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	// ── Conflict ────────────────────────────────────────────────

	describe("conflict", () => {
		it("returns 409 when organizer profile already exists", async () => {
			setupOrganizerSession(app);
			const { ConflictError } = await import("../../../src/lib/errors.js");
			mockRegisterOrganizer.mockRejectedValue(
				new ConflictError("Organizer profile already exists for this user"),
			);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: REGISTER_URL,
				...csrf,
				payload: validRegistrationBody,
			});

			expect(response.statusCode).toBe(409);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "CONFLICT" },
			});
		});
	});
});

describe("GET /api/v1/organizers/me", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRegisterOrganizer.mockReset();
		mockGetOrganizerByUserId.mockReset();
		mockUpdateOrganizer.mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("returns organizer profile", () => {
		it("returns 200 with profile data", async () => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);

			const response = await app.inject({
				method: "GET",
				url: ME_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: mockOrganizerProfile,
			});
		});
	});

	// ── Not found ───────────────────────────────────────────────

	describe("no organizer profile", () => {
		it("returns 404 when user has no organizer profile", async () => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(null);

			const response = await app.inject({
				method: "GET",
				url: ME_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "GET",
				url: ME_URL,
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
				url: ME_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
		});
	});
});
