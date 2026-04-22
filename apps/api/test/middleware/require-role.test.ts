import {
	type vi,
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { requireRole } from "../../src/middleware/require-role.js";

const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeSession(role: string) {
	return JSON.stringify({
		userId: "user-001",
		role,
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
	});
}

function buildTestApp(): FastifyInstance {
	const app = buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			INTERNAL_API_KEY: "test-internal-key",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		},
	});

	// Handler echoes session data for assertions
	const handler = async (request: { session: unknown }) => ({
		session: request.session,
	});

	app.get(
		"/test/participant-only",
		{ onRequest: [requireRole("participant")] },
		handler,
	);
	app.get(
		"/test/organizer-only",
		{ onRequest: [requireRole("organizer")] },
		handler,
	);
	app.get(
		"/test/admin-only",
		{ onRequest: [requireRole("admin")] },
		handler,
	);

	return app;
}

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function injectAs(app: FastifyInstance, role: string, url: string) {
	getSessionRedisMock(app).mockResolvedValue(makeSession(role));
	return app.inject({
		method: "GET",
		url,
		cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
	});
}

describe("requireRole middleware", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset().mockResolvedValue(null);
	});

	// ── Admin access (highest role) ────────────────────────────

	describe("admin role", () => {
		it("can access admin-only route", async () => {
			const res = await injectAs(app, "admin", "/test/admin-only");
			expect(res.statusCode).toBe(200);
		});

		it("can access organizer route (hierarchy)", async () => {
			const res = await injectAs(app, "admin", "/test/organizer-only");
			expect(res.statusCode).toBe(200);
		});

		it("can access participant route (hierarchy)", async () => {
			const res = await injectAs(app, "admin", "/test/participant-only");
			expect(res.statusCode).toBe(200);
		});
	});

	// ── Organizer access ───────────────────────────────────────

	describe("organizer role", () => {
		it("can access organizer route", async () => {
			const res = await injectAs(app, "organizer", "/test/organizer-only");
			expect(res.statusCode).toBe(200);
		});

		it("can access participant route (hierarchy)", async () => {
			const res = await injectAs(app, "organizer", "/test/participant-only");
			expect(res.statusCode).toBe(200);
		});

		it("cannot access admin route (403)", async () => {
			const res = await injectAs(app, "organizer", "/test/admin-only");
			expect(res.statusCode).toBe(403);
		});
	});

	// ── Participant access ─────────────────────────────────────

	describe("participant role", () => {
		it("can access participant route", async () => {
			const res = await injectAs(app, "participant", "/test/participant-only");
			expect(res.statusCode).toBe(200);
		});

		it("cannot access organizer route (403)", async () => {
			const res = await injectAs(app, "participant", "/test/organizer-only");
			expect(res.statusCode).toBe(403);
		});

		it("cannot access admin route (403)", async () => {
			const res = await injectAs(app, "participant", "/test/admin-only");
			expect(res.statusCode).toBe(403);
		});
	});

	// ── Error response structure ───────────────────────────────

	describe("error responses", () => {
		it("403 includes INSUFFICIENT_ROLE code and requiredRole in details", async () => {
			const res = await injectAs(
				app,
				"participant",
				"/test/organizer-only",
			);

			expect(res.statusCode).toBe(403);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "INSUFFICIENT_ROLE",
					message: "Insufficient permissions. organizer role required",
					details: { requiredRole: "organizer" },
				},
			});
		});

		it("unauthenticated user gets 401, not 403", async () => {
			// No cookie — session is null before role check
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-only",
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
				},
			});
		});

		it("expired session (not in Redis) returns 401", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const res = await app.inject({
				method: "GET",
				url: "/test/admin-only",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json().error.code).toBe("UNAUTHORIZED");
		});
	});
});
