import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Service mocks MUST be defined before imports that trigger module loading
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

// ── Constants ────────────────────────────────────────────────────
const SESSION_URL = "/api/v1/auth/session";
const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const validSession = {
	userId: "550e8400-e29b-41d4-a716-446655440000",
	role: "participant",
	expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

// ── Helpers ──────────────────────────────────────────────────────

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupAuthenticatedSession(
	app: FastifyInstance,
	session = validSession,
) {
	getSessionRedisMock(app).mockResolvedValue(JSON.stringify(session));
}

function buildAuthenticatedRequest() {
	return {
		method: "GET" as const,
		url: SESSION_URL,
		cookies: {
			[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
		},
	};
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /api/v1/auth/session", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("authenticated session", () => {
		it("returns 200 with userId and role", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					userId: "550e8400-e29b-41d4-a716-446655440000",
					role: "participant",
				},
			});
		});

		it("does NOT expose sessionId in the response", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			const body = response.json();
			expect(body.data).not.toHaveProperty("sessionId");
		});

		it("sets Cache-Control: private, no-store header", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.headers["cache-control"]).toBe("private, no-store");
		});

		it("returns success: true in the response", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.json()).toHaveProperty("success", true);
			expect(response.json()).toHaveProperty("data");
			expect(response.json().data).toHaveProperty("userId");
			expect(response.json().data).toHaveProperty("role");
		});
	});

	// ── Unauthenticated ─────────────────────────────────────────

	describe("unauthenticated requests", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "GET",
				url: SESSION_URL,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "UNAUTHORIZED",
				},
			});
		});

		it("returns 401 when session is not found in Redis (expired/invalid)", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const response = await app.inject({
				method: "GET",
				url: SESSION_URL,
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
	});

	// ── Role variations ─────────────────────────────────────────

	describe("role variations", () => {
		it("returns organizer role", async () => {
			setupAuthenticatedSession(app, {
				userId: "660e8400-e29b-41d4-a716-446655440001",
				role: "organizer",
				expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			});

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					userId: "660e8400-e29b-41d4-a716-446655440001",
					role: "organizer",
				},
			});
		});

		it("returns admin role", async () => {
			setupAuthenticatedSession(app, {
				userId: "770e8400-e29b-41d4-a716-446655440002",
				role: "admin",
				expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			});

			const response = await app.inject(buildAuthenticatedRequest());

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					userId: "770e8400-e29b-41d4-a716-446655440002",
					role: "admin",
				},
			});
		});
	});
});
