import type { FastifyInstance } from "fastify";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	type vi,
} from "vitest";
import { buildApp } from "../../src/app.js";

const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_URL = "/test/internal";
const VALID_INTERNAL_KEY = "test-internal-key";

const validSession = {
	userId: "user-001",
	role: "participant",
	expiresAt: new Date(Date.now() + 86_400_000).toISOString(), // +1 day
};

function buildTestAppWithKey(): FastifyInstance {
	const app = buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			INTERNAL_API_KEY: VALID_INTERNAL_KEY,
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		},
	});

	app.get(TEST_URL, async (request) => ({
		isInternalRequest: request.isInternalRequest,
		session: request.session,
	}));

	app.post(TEST_URL, async (request) => ({
		isInternalRequest: request.isInternalRequest,
	}));

	return app;
}

function buildTestAppWithoutKey(): FastifyInstance {
	const app = buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			INTERNAL_API_KEY: "",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		},
	});

	app.get(TEST_URL, async (request) => ({
		isInternalRequest: request.isInternalRequest,
		session: request.session,
	}));

	app.post(TEST_URL, async (request) => ({
		isInternalRequest: request.isInternalRequest,
	}));

	return app;
}

/** Return the mock `get` function on the session Redis client. */
function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

describe("internal-key plugin", () => {
	let app: FastifyInstance;
	let appWithoutKey: FastifyInstance;

	beforeAll(async () => {
		app = buildTestAppWithKey();
		await app.ready();
		appWithoutKey = buildTestAppWithoutKey();
		await appWithoutKey.ready();
	});

	afterAll(async () => {
		await app?.close();
		await appWithoutKey?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset().mockResolvedValue(null);
		getSessionRedisMock(appWithoutKey).mockReset().mockResolvedValue(null);
	});

	// ── 1. No X-Internal-Key header ────────────────────────────

	describe("no X-Internal-Key header", () => {
		it("sets isInternalRequest to false", async () => {
			const res = await app.inject({ method: "GET", url: TEST_URL });

			expect(res.statusCode).toBe(200);
			expect(res.json().isInternalRequest).toBe(false);
		});

		it("request succeeds with 200", async () => {
			const res = await app.inject({ method: "GET", url: TEST_URL });

			expect(res.statusCode).toBe(200);
		});
	});

	// ── 2. Valid X-Internal-Key header ─────────────────────────

	describe("valid X-Internal-Key header", () => {
		it("sets isInternalRequest to true", async () => {
			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": VALID_INTERNAL_KEY },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json().isInternalRequest).toBe(true);
		});

		it("request succeeds with 200", async () => {
			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": VALID_INTERNAL_KEY },
			});

			expect(res.statusCode).toBe(200);
		});
	});

	// ── 3. Invalid X-Internal-Key header ───────────────────────

	describe("invalid X-Internal-Key header", () => {
		it("returns 401 with UNAUTHORIZED error code", async () => {
			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": "wrong-key-same-length!" },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Invalid internal API key",
				},
			});
		});
	});

	// ── 4. INTERNAL_API_KEY not configured ─────────────────────

	describe("INTERNAL_API_KEY not configured", () => {
		it("returns 401 when X-Internal-Key header is sent", async () => {
			const res = await appWithoutKey.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": VALID_INTERNAL_KEY },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Internal API key not configured",
				},
			});
		});
	});

	// ── 5. Session coexistence ─────────────────────────────────

	describe("session coexistence", () => {
		it("populates both isInternalRequest and session", async () => {
			getSessionRedisMock(app).mockResolvedValue(JSON.stringify(validSession));

			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": VALID_INTERNAL_KEY },
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);

			const body = res.json();
			expect(body.isInternalRequest).toBe(true);
			expect(body.session).toEqual({
				userId: validSession.userId,
				role: validSession.role,
				sessionId: TEST_SESSION_ID,
			});
		});
	});

	// ── 6. CSRF bypass for internal requests ───────────────────

	describe("CSRF bypass for internal requests", () => {
		it("bypasses CSRF validation for POST with valid internal key", async () => {
			getSessionRedisMock(app).mockResolvedValue(JSON.stringify(validSession));

			const res = await app.inject({
				method: "POST",
				url: TEST_URL,
				headers: { "x-internal-key": VALID_INTERNAL_KEY },
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json().isInternalRequest).toBe(true);
		});

		it("enforces CSRF for POST without internal key", async () => {
			getSessionRedisMock(app).mockResolvedValue(JSON.stringify(validSession));

			const res = await app.inject({
				method: "POST",
				url: TEST_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json().error.code).toBe("CSRF_VALIDATION_FAILED");
		});
	});

	// ── 7. Wrong length key ────────────────────────────────────

	describe("wrong length key", () => {
		it("returns 401 for a key shorter than configured", async () => {
			const res = await app.inject({
				method: "GET",
				url: TEST_URL,
				headers: { "x-internal-key": "short" },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Invalid internal API key",
				},
			});
		});
	});
});
