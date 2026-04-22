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
import { requireAuth } from "../../src/middleware/require-auth.js";

const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_URL = "/test/protected";

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

	// Protected route that echoes session data back for assertions
	app.get(
		TEST_URL,
		{ onRequest: [requireAuth] },
		async (request) => ({
			session: request.session,
		}),
	);

	return app;
}

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

describe("requireAuth middleware", () => {
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

	// ── Authenticated requests ─────────────────────────────────

	describe("authenticated request", () => {
		it("allows the request through (200)", async () => {
			getSessionRedisMock(app).mockResolvedValue(makeSession("participant"));

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
		});

		it("handler receives correct session data", async () => {
			getSessionRedisMock(app).mockResolvedValue(makeSession("organizer"));

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			const body = res.json();
			expect(body.session).toEqual({
				userId: "user-001",
				role: "organizer",
				sessionId: TEST_SESSION_ID,
			});
		});
	});

	// ── Unauthenticated requests ───────────────────────────────

	describe("unauthenticated request", () => {
		it("returns 401 when no session cookie is sent", async () => {
			const res = await app.inject({ method: "GET", url: TEST_URL });

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
				},
			});
		});

		it("returns 401 when session cookie is present but session is not in Redis", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
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
	});
});
