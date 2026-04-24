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

const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_URL = "/test/session";

const validSession = {
	userId: "user-001",
	role: "participant",
	expiresAt: new Date(Date.now() + 86_400_000).toISOString(), // +1 day
};

function buildTestAppWithRoute(): FastifyInstance {
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

	// Diagnostic route that exposes request.session for assertions
	app.get(TEST_URL, async (request) => ({ session: request.session }));

	return app;
}

/** Return the mock `get` function on the session Redis client. */
function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

/** Return the mock `del` function on the session Redis client. */
function getSessionRedisDelMock(app: FastifyInstance) {
	return app.redis.session.del as ReturnType<typeof vi.fn>;
}

describe("auth plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestAppWithRoute();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset().mockResolvedValue(null);
		getSessionRedisDelMock(app).mockReset().mockResolvedValue(1);
	});

	// ── 1. No cookie → session is null ──────────────────────────

	describe("no cookie", () => {
		it("sets request.session to null", async () => {
			const res = await app.inject({ method: "GET", url: TEST_URL });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ session: null });
		});

		it("does not set a Set-Cookie header", async () => {
			const res = await app.inject({ method: "GET", url: TEST_URL });

			expect(res.headers["set-cookie"]).toBeUndefined();
		});
	});

	// ── 2. Valid cookie + valid Redis session ───────────────────

	describe("valid cookie + valid session in Redis", () => {
		it("populates request.session with userId, role, sessionId", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({
				session: {
					userId: validSession.userId,
					role: validSession.role,
					sessionId: TEST_SESSION_ID,
				},
			});
		});

		it("does not clear the cookie", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(validSession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.headers["set-cookie"]).toBeUndefined();
		});
	});

	// ── 3. Valid cookie + no Redis session (expired/deleted) ────

	describe("valid cookie + session not found in Redis", () => {
		it("sets request.session to null", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ session: null });
		});

		it("clears the stale cookie", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			const setCookie = res.headers["set-cookie"] as string;
			expect(setCookie).toBeDefined();
			expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
			// Cleared cookie has an Expires in the past or empty value
			expect(setCookie).toMatch(
				/kiran_session=;|Expires=Thu, 01 Jan 1970/,
			);
		});
	});

	// ── 4. Valid cookie + expired expiresAt ──────────────────────

	describe("valid cookie + expired session (past expiresAt)", () => {
		const expiredSession = {
			...validSession,
			expiresAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
		};

		it("sets request.session to null", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(expiredSession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.json()).toEqual({ session: null });
		});

		it("clears the stale cookie", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(expiredSession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			const setCookie = res.headers["set-cookie"] as string;
			expect(setCookie).toBeDefined();
			expect(setCookie).toMatch(
				/kiran_session=;|Expires=Thu, 01 Jan 1970/,
			);
		});

		it("deletes the expired session key from Redis", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(expiredSession),
			);

			await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(getSessionRedisDelMock(app)).toHaveBeenCalledWith(
				TEST_SESSION_ID,
			);
		});
	});

	// ── 5. Valid cookie + invalid expiresAt (NaN / garbage) ─────

	describe("valid cookie + invalid expiresAt", () => {
		it("treats garbage expiresAt as expired", async () => {
			const garbageSession = { ...validSession, expiresAt: "not-a-date" };
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(garbageSession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.json()).toEqual({ session: null });

			const setCookie = res.headers["set-cookie"] as string;
			expect(setCookie).toBeDefined();
			expect(setCookie).toMatch(
				/kiran_session=;|Expires=Thu, 01 Jan 1970/,
			);
		});

		it("treats empty expiresAt as expired", async () => {
			const emptySession = { ...validSession, expiresAt: "" };
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(emptySession),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.json()).toEqual({ session: null });
			expect(getSessionRedisDelMock(app)).toHaveBeenCalled();
		});
	});

	// ── 6. Redis error (transient failure) ──────────────────────

	describe("Redis error (transient failure)", () => {
		it("sets request.session to null", async () => {
			getSessionRedisMock(app).mockRejectedValue(
				new Error("ECONNREFUSED"),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.json()).toEqual({ session: null });
		});

		it("does NOT clear the cookie (preserves session for retry)", async () => {
			getSessionRedisMock(app).mockRejectedValue(
				new Error("ECONNREFUSED"),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.headers["set-cookie"]).toBeUndefined();
		});
	});

	// ── 7. Redis del failure on expired session ─────────────────

	describe("Redis del failure on expired session cleanup", () => {
		const expiredSession = {
			...validSession,
			expiresAt: new Date(Date.now() - 60_000).toISOString(),
		};

		it("still sets request.session to null", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(expiredSession),
			);
			getSessionRedisDelMock(app).mockRejectedValue(
				new Error("Redis DEL failed"),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.json()).toEqual({ session: null });
		});

		it("still clears the stale cookie", async () => {
			getSessionRedisMock(app).mockResolvedValue(
				JSON.stringify(expiredSession),
			);
			getSessionRedisDelMock(app).mockRejectedValue(
				new Error("Redis DEL failed"),
			);

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			const setCookie = res.headers["set-cookie"] as string;
			expect(setCookie).toBeDefined();
			expect(setCookie).toMatch(
				/kiran_session=;|Expires=Thu, 01 Jan 1970/,
			);
		});
	});
});
