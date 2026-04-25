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
const mockRegisterOrganizer = vi.fn();
const mockGetOrganizerByUserId = vi.fn();
const mockUpdateOrganizer = vi.fn();

vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: (...args: unknown[]) => mockRegisterOrganizer(...args),
	getOrganizerByUserId: (...args: unknown[]) =>
		mockGetOrganizerByUserId(...args),
	updateOrganizer: (...args: unknown[]) => mockUpdateOrganizer(...args),
}));

import type { FastifyInstance } from "fastify";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

// ── Constants ────────────────────────────────────────────────────
const UPDATE_URL = "/api/v1/organizers/me";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

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
	razorpayAccountStatus: "not_started",
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

describe("PUT /api/v1/organizers/me", () => {
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

	describe("successful update", () => {
		it("returns 200 with updated profile on full update", async () => {
			setupOrganizerSession(app);
			const updatedProfile = {
				...mockOrganizerProfile,
				businessName: "Chennai Events Co",
				contactName: "Suresh Babu",
				contactEmail: "suresh@chennaievents.in",
				contactPhone: "+919123456789",
				city: "Chennai",
				description: "Top event organizer in Chennai",
				website: "https://chennaievents.in",
			};
			mockUpdateOrganizer.mockResolvedValue(updatedProfile);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: {
					businessName: "Chennai Events Co",
					contactName: "Suresh Babu",
					contactEmail: "suresh@chennaievents.in",
					contactPhone: "+919123456789",
					city: "Chennai",
					description: "Top event organizer in Chennai",
					website: "https://chennaievents.in",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: updatedProfile,
			});
		});

		it("returns 200 on partial update with single field (city)", async () => {
			setupOrganizerSession(app);
			const updatedProfile = { ...mockOrganizerProfile, city: "Chennai" };
			mockUpdateOrganizer.mockResolvedValue(updatedProfile);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { city: "Chennai" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: updatedProfile,
			});
		});

		it("returns 200 on partial update with multiple fields", async () => {
			setupOrganizerSession(app);
			const updatedProfile = {
				...mockOrganizerProfile,
				businessName: "Updated Runners",
				description: "Updated description",
			};
			mockUpdateOrganizer.mockResolvedValue(updatedProfile);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: {
					businessName: "Updated Runners",
					description: "Updated description",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: updatedProfile,
			});
		});

		it("calls updateOrganizer with correct args", async () => {
			setupOrganizerSession(app);
			mockUpdateOrganizer.mockResolvedValue(mockOrganizerProfile);
			const csrf = buildCsrfHeaders();

			await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { city: "Chennai", businessName: "New Name" },
			});

			expect(mockUpdateOrganizer).toHaveBeenCalledTimes(1);
			const [deps, userId, data] = mockUpdateOrganizer.mock.calls[0] as [
				unknown,
				string,
				unknown,
			];
			expect(userId).toBe(TEST_USER_ID);
			expect(data).toMatchObject({
				city: "Chennai",
				businessName: "New Name",
			});
		});
	});

	// ── Validation ──────────────────────────────────────────────

	describe("validation", () => {
		it("returns 400 when body is empty (no fields provided)", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: {},
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when businessName is too short", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { businessName: "A" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when contactEmail is invalid", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { contactEmail: "not-email" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when website is not a valid URL", async () => {
			setupOrganizerSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { website: "not-url" },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				payload: { city: "Chennai" },
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
				method: "PUT",
				url: UPDATE_URL,
				cookies: csrf.cookies,
				headers: csrf.headers,
				payload: { city: "Chennai" },
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
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { city: "Chennai" },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});
	});

	// ── Not found ───────────────────────────────────────────────

	describe("not found", () => {
		it("returns 404 when no organizer profile exists", async () => {
			setupOrganizerSession(app);
			mockUpdateOrganizer.mockResolvedValue(null);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "PUT",
				url: UPDATE_URL,
				...csrf,
				payload: { city: "Chennai" },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});
	});
});
