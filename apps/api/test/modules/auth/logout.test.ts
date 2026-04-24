import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Service mock MUST be defined before imports that trigger module loading
const mockLogoutSession = vi.fn();
const mockSendOtpForPhone = vi.fn();
const mockVerifyOtpAndCreateSession = vi.fn();

vi.mock("../../../src/modules/auth/service.js", () => ({
	sendOtpForPhone: (...args: unknown[]) => mockSendOtpForPhone(...args),
	verifyOtpAndCreateSession: (...args: unknown[]) =>
		mockVerifyOtpAndCreateSession(...args),
	logoutSession: (...args: unknown[]) => mockLogoutSession(...args),
}));

import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../helpers/build-app.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";

// ── Constants ────────────────────────────────────────────────────
const LOGOUT_URL = "/api/v1/auth/logout";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const validSession = {
	userId: "user-001",
	role: "participant",
	expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

// ── Helpers ──────────────────────────────────────────────────────

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function findCookie(
	setCookieHeader: string | string[] | undefined,
	name: string,
): string | undefined {
	if (!setCookieHeader) return undefined;
	const cookies = Array.isArray(setCookieHeader)
		? setCookieHeader
		: [setCookieHeader];
	return cookies.find((c) => c.startsWith(`${name}=`));
}

function buildAuthenticatedRequest() {
	const csrfToken = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
	return {
		method: "POST" as const,
		url: LOGOUT_URL,
		cookies: {
			[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
			[CSRF_COOKIE_NAME]: csrfToken,
		},
		headers: {
			[CSRF_HEADER_NAME]: csrfToken,
		},
	};
}

function setupAuthenticatedSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(JSON.stringify(validSession));
	mockLogoutSession.mockResolvedValue(undefined);
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /api/v1/auth/logout", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockLogoutSession.mockReset();
		mockSendOtpForPhone.mockReset();
		mockVerifyOtpAndCreateSession.mockReset();
		getSessionRedisMock(app).mockReset();
	});

	// ── Happy path ───────────────────────────────────────────────

	describe("successful logout", () => {
		it("returns 200 with success payload", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					message: "Logged out successfully",
				},
			});
		});

		it("calls logoutSession with correct deps and sessionId", async () => {
			setupAuthenticatedSession(app);

			await app.inject(buildAuthenticatedRequest());

			expect(mockLogoutSession).toHaveBeenCalledOnce();
			const [deps, sessionId] = mockLogoutSession.mock.calls[0]!;

			expect(sessionId).toBe(TEST_SESSION_ID);
			expect(deps).toHaveProperty("sessionRedis");
			expect(deps).toHaveProperty("db");
			expect(deps).toHaveProperty("log");
		});

		it("clears the kiran_session cookie", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			const setCookieRaw = response.headers["set-cookie"];
			const sessionCookie = findCookie(setCookieRaw, SESSION_COOKIE_NAME);

			expect(sessionCookie).toBeDefined();
			// Cleared cookie should have an expired date or empty value
			expect(sessionCookie).toMatch(
				/kiran_session=;|kiran_session=.*Expires=Thu, 01 Jan 1970/i,
			);
		});

		it("clears the __csrf cookie", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			const setCookieRaw = response.headers["set-cookie"];
			const csrfCookie = findCookie(setCookieRaw, CSRF_COOKIE_NAME);

			expect(csrfCookie).toBeDefined();
			expect(csrfCookie).toMatch(
				/__csrf=;|__csrf=.*Expires=Thu, 01 Jan 1970/i,
			);
		});
	});

	// ── Unauthenticated ──────────────────────────────────────────

	describe("unauthenticated requests", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "UNAUTHORIZED",
				},
			});
		});

		it("returns 401 when session is not found in Redis (stale cookie)", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
				},
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "UNAUTHORIZED",
				},
			});
		});

		it("does not call logoutSession when unauthenticated", async () => {
			await app.inject({
				method: "POST",
				url: LOGOUT_URL,
			});

			expect(mockLogoutSession).not.toHaveBeenCalled();
		});
	});

	// ── CSRF validation ──────────────────────────────────────────

	describe("CSRF validation", () => {
		it("returns 403 when CSRF cookie and header are missing", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);

			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
				},
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "CSRF_VALIDATION_FAILED",
				},
			});
		});

		it("returns 403 when CSRF header is missing but cookie is present", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);
			const csrfToken = generateCsrfToken(
				TEST_SESSION_ID,
				TEST_CSRF_SECRET,
			);

			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: csrfToken,
				},
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "CSRF_VALIDATION_FAILED",
				},
			});
		});

		it("returns 403 when CSRF token is tampered/invalid", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);
			const tamperedToken = "tampered-random.tampered-signature";

			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: tamperedToken,
				},
				headers: {
					[CSRF_HEADER_NAME]: tamperedToken,
				},
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "CSRF_VALIDATION_FAILED",
				},
			});
		});

		it("returns 403 when CSRF cookie and header mismatch", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);
			const csrfToken = generateCsrfToken(
				TEST_SESSION_ID,
				TEST_CSRF_SECRET,
			);

			const response = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: csrfToken,
				},
				headers: {
					[CSRF_HEADER_NAME]: "different-token.value",
				},
			});

			expect(response.statusCode).toBe(403);
		});
	});

	// ── Service error ────────────────────────────────────────────

	describe("service errors", () => {
		it("returns 500 when logoutSession throws", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);
			mockLogoutSession.mockRejectedValue(
				new Error("Redis connection failed"),
			);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(500);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "INTERNAL_ERROR",
				},
			});
		});
	});

	// ── Idempotency ──────────────────────────────────────────────

	describe("idempotency", () => {
		it("second call returns 401 after session is invalidated", async () => {
			setupAuthenticatedSession(app);

			const first = await app.inject(buildAuthenticatedRequest());
			expect(first.statusCode).toBe(200);

			// After logout, session no longer exists in Redis
			getSessionRedisMock(app).mockResolvedValue(null);

			const second = await app.inject({
				method: "POST",
				url: LOGOUT_URL,
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
				},
			});

			expect(second.statusCode).toBe(401);
		});
	});

	// ── Different roles ──────────────────────────────────────────

	describe("role variations", () => {
		it("succeeds for organizer role", async () => {
			const organizerSession = {
				userId: "user-002",
				role: "organizer",
				expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			};
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(organizerSession),
			);
			mockLogoutSession.mockResolvedValue(undefined);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({
				success: true,
				data: { message: "Logged out successfully" },
			});
		});

		it("succeeds for admin role", async () => {
			const adminSession = {
				userId: "user-003",
				role: "admin",
				expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			};
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(adminSession),
			);
			mockLogoutSession.mockResolvedValue(undefined);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({
				success: true,
				data: { message: "Logged out successfully" },
			});
		});
	});
});
