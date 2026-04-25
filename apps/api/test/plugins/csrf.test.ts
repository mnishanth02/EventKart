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
import { generateCsrfToken } from "../../src/plugins/csrf.js";

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

function buildTestAppWithRoutes(): FastifyInstance {
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

	app.post("/test/csrf", async (request) => ({ session: request.session }));
	app.get("/test/csrf", async (request) => ({ session: request.session }));
	app.put("/test/csrf", async (request) => ({ session: request.session }));
	app.delete("/test/csrf", async (request) => ({ session: request.session }));
	app.patch("/test/csrf", async (request) => ({ session: request.session }));
	app.post(
		"/test/no-csrf",
		{ config: { csrfProtection: false } },
		async () => ({ ok: true }),
	);

	return app;
}

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupAuthenticatedSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(JSON.stringify(validSession));
}

function buildValidCsrfCookies(token: string) {
	return {
		[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
		[CSRF_COOKIE_NAME]: token,
	};
}

describe("csrf plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestAppWithRoutes();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset().mockResolvedValue(null);
	});

	// ── 1. GET requests bypass CSRF ──────────────────────────────

	describe("safe methods bypass CSRF", () => {
		it("GET with session passes without CSRF token", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "GET",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json().session).toEqual({
				userId: validSession.userId,
				role: validSession.role,
				sessionId: TEST_SESSION_ID,
			});
		});

		// ── 15. HEAD request bypasses CSRF ──────────────────────────
		it("HEAD with session passes without CSRF token", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "HEAD",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
		});

		// ── 16. OPTIONS request bypasses CSRF ───────────────────────
		it("OPTIONS with session is handled (CORS preflight)", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "OPTIONS",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
				headers: {
					origin: "http://localhost:3000",
					"access-control-request-method": "POST",
				},
			});

			// OPTIONS is a safe method — CSRF plugin does not block it
			expect(res.statusCode).not.toBe(403);
		});
	});

	// ── 2. Unauthenticated POST requests bypass CSRF ─────────────

	describe("unauthenticated requests bypass CSRF", () => {
		it("POST without session cookie passes without CSRF token", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ session: null });
		});

		it("POST with invalid session (not in Redis) passes without CSRF", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: "nonexistent-session-id" },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ session: null });
		});
	});

	// ── 3. Valid CSRF token passes ───────────────────────────────

	describe("valid CSRF token", () => {
		it("POST with valid cookie + header passes", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: buildValidCsrfCookies(token),
				headers: { [CSRF_HEADER_NAME]: token },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json().session).toEqual({
				userId: validSession.userId,
				role: validSession.role,
				sessionId: TEST_SESSION_ID,
			});
		});

		it("PUT with valid CSRF token passes", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "PUT",
				url: "/test/csrf",
				cookies: buildValidCsrfCookies(token),
				headers: { [CSRF_HEADER_NAME]: token },
			});

			expect(res.statusCode).toBe(200);
		});

		it("DELETE with valid CSRF token passes", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "DELETE",
				url: "/test/csrf",
				cookies: buildValidCsrfCookies(token),
				headers: { [CSRF_HEADER_NAME]: token },
			});

			expect(res.statusCode).toBe(200);
		});

		it("PATCH with valid CSRF token passes", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "PATCH",
				url: "/test/csrf",
				cookies: buildValidCsrfCookies(token),
				headers: { [CSRF_HEADER_NAME]: token },
			});

			expect(res.statusCode).toBe(200);
		});
	});

	// ── 4. Missing CSRF header → 403 ─────────────────────────────

	describe("missing CSRF header", () => {
		it("returns 403 CSRF_VALIDATION_FAILED", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: buildValidCsrfCookies(token),
				// no x-csrf-token header
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 5. Missing CSRF cookie → 403 ─────────────────────────────

	describe("missing CSRF cookie", () => {
		it("returns 403 CSRF_VALIDATION_FAILED", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
				headers: { [CSRF_HEADER_NAME]: token },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 6. Tampered signature → 403 ──────────────────────────────

	describe("tampered signature", () => {
		it("returns 403 when signature is altered", async () => {
			setupAuthenticatedSession(app);
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
			// Flip a character in the signature portion
			const parts = token.split(".");
			const tamperedSig =
				parts[1]?.slice(0, -2) + (parts[1]?.endsWith("AA") ? "BB" : "AA");
			const tampered = `${parts[0]}.${tamperedSig}`;

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: tampered,
				},
				headers: { [CSRF_HEADER_NAME]: tampered },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 7. Header / cookie mismatch → 403 ────────────────────────

	describe("header / cookie mismatch", () => {
		it("returns 403 when header and cookie tokens differ", async () => {
			setupAuthenticatedSession(app);
			const tokenA = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
			const tokenB = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: tokenA,
				},
				headers: { [CSRF_HEADER_NAME]: tokenB },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 8. Malformed token (no dot separator) → 403 ──────────────

	describe("malformed token — no dot separator", () => {
		it("returns 403 for token without dot", async () => {
			setupAuthenticatedSession(app);
			const malformed = "nodotinthisbase64urltoken";

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: malformed,
				},
				headers: { [CSRF_HEADER_NAME]: malformed },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 9. Malformed token (empty parts) → 403 ───────────────────

	describe("malformed token — empty parts", () => {
		it("returns 403 for token with empty random part", async () => {
			setupAuthenticatedSession(app);
			const malformed = ".somesignature";

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: malformed,
				},
				headers: { [CSRF_HEADER_NAME]: malformed },
			});

			expect(res.statusCode).toBe(403);
		});

		it("returns 403 for token with empty signature part", async () => {
			setupAuthenticatedSession(app);
			const malformed = "somerandom.";

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: malformed,
				},
				headers: { [CSRF_HEADER_NAME]: malformed },
			});

			expect(res.statusCode).toBe(403);
		});
	});

	// ── 10. Token from different session → 403 ───────────────────

	describe("token from different session", () => {
		it("returns 403 when token was generated for a different sessionId", async () => {
			setupAuthenticatedSession(app);
			const wrongSessionToken = generateCsrfToken(
				"different-session-id",
				TEST_CSRF_SECRET,
			);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: wrongSessionToken,
				},
				headers: { [CSRF_HEADER_NAME]: wrongSessionToken },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 11. Route with csrfProtection: false bypasses validation ─

	describe("csrfProtection opt-out", () => {
		it("POST /test/no-csrf with session but no CSRF passes", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "POST",
				url: "/test/no-csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ ok: true });
		});
	});

	// ── 12–14. PUT / DELETE / PATCH validated without token → 403 ─

	describe("state-changing methods require CSRF when authenticated", () => {
		it("PUT without CSRF token returns 403", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "PUT",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});

		it("DELETE without CSRF token returns 403", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "DELETE",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});

		it("PATCH without CSRF token returns 403", async () => {
			setupAuthenticatedSession(app);

			const res = await app.inject({
				method: "PATCH",
				url: "/test/csrf",
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});

	// ── 17. generateCsrfToken produces valid format ──────────────

	describe("generateCsrfToken", () => {
		it("produces a token in <base64url>.<base64url> format", () => {
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
			const base64urlPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

			expect(token).toMatch(base64urlPattern);
		});

		it("generates different tokens on successive calls", () => {
			const tokenA = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
			const tokenB = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);

			expect(tokenA).not.toBe(tokenB);
		});

		it("produces tokens with two non-empty parts", () => {
			const token = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
			const parts = token.split(".");

			expect(parts).toHaveLength(2);
			expect(parts[0]?.length).toBeGreaterThan(0);
			expect(parts[1]?.length).toBeGreaterThan(0);
		});
	});

	// ── 18. Token signed with wrong secret → 403 ────────────────

	describe("token signed with wrong secret", () => {
		it("returns 403 when token was signed with a different secret", async () => {
			setupAuthenticatedSession(app);
			const wrongSecretToken = generateCsrfToken(
				TEST_SESSION_ID,
				"wrong-secret-key",
			);

			const res = await app.inject({
				method: "POST",
				url: "/test/csrf",
				cookies: {
					[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
					[CSRF_COOKIE_NAME]: wrongSecretToken,
				},
				headers: { [CSRF_HEADER_NAME]: wrongSecretToken },
			});

			expect(res.statusCode).toBe(403);
			expect(res.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});
});
