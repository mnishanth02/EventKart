import {
	vi,
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
} from "vitest";

// Service mocks MUST be defined before imports that trigger module loading
const mockSendVerificationEmail = vi.fn();
const mockVerifyEmailToken = vi.fn();
const mockSendOtpForPhone = vi.fn();
const mockVerifyOtpAndCreateSession = vi.fn();
const mockLogoutSession = vi.fn();

vi.mock("../../../src/modules/auth/email-verification-service.js", () => ({
	sendVerificationEmail: (...args: unknown[]) =>
		mockSendVerificationEmail(...args),
	verifyEmailToken: (...args: unknown[]) => mockVerifyEmailToken(...args),
}));

vi.mock("../../../src/modules/auth/service.js", () => ({
	sendOtpForPhone: (...args: unknown[]) => mockSendOtpForPhone(...args),
	verifyOtpAndCreateSession: (...args: unknown[]) =>
		mockVerifyOtpAndCreateSession(...args),
	logoutSession: (...args: unknown[]) => mockLogoutSession(...args),
}));

import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../helpers/build-app.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import {
	RateLimitError,
	ValidationError,
} from "../../../src/lib/errors.js";
import { EMAIL_VERIFICATION_TOKEN_TTL_SECONDS } from "@repo/shared/constants";

// ── Constants ────────────────────────────────────────────────────
const SEND_URL = "/api/v1/auth/email/send-verification";
const VERIFY_URL = "/api/v1/auth/email/verify";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";
const VALID_TOKEN = "a".repeat(64); // 64 hex chars

const validSession = {
	userId: "user-001",
	role: "participant",
	expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

// ── Helpers ──────────────────────────────────────────────────────

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function buildAuthenticatedRequest(
	url: string,
	payload: Record<string, unknown>,
) {
	const csrfToken = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
	return {
		method: "POST" as const,
		url,
		payload,
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
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /api/v1/auth/email/send-verification", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockSendVerificationEmail.mockReset();
		mockVerifyEmailToken.mockReset();
		mockSendOtpForPhone.mockReset();
		mockVerifyOtpAndCreateSession.mockReset();
		mockLogoutSession.mockReset();
		getSessionRedisMock(app).mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("happy path", () => {
		it("returns 200 with message when authenticated user sends verification", async () => {
			setupAuthenticatedSession(app);
			mockSendVerificationEmail.mockResolvedValue({
				message: "Verification email sent",
				expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
			});

			const response = await app.inject(
				buildAuthenticatedRequest(SEND_URL, {
					email: "test@example.com",
				}),
			);

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					message: "Verification email sent",
					expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
				},
			});
		});

		it("passes correct deps and email to service", async () => {
			setupAuthenticatedSession(app);
			mockSendVerificationEmail.mockResolvedValue({
				message: "Verification email sent",
				expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
			});

			await app.inject(
				buildAuthenticatedRequest(SEND_URL, {
					email: "Test@Example.COM",
				}),
			);

			expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
			const [deps, userId, email] =
				mockSendVerificationEmail.mock.calls[0]!;
			expect(deps).toHaveProperty("db");
			expect(deps).toHaveProperty("redis");
			expect(deps).toHaveProperty("emailQueue");
			expect(deps).toHaveProperty("config");
			expect(deps).toHaveProperty("log");
			expect(userId).toBe("user-001");
			// emailSchema transforms to lowercase
			expect(email).toBe("test@example.com");
		});
	});

	// ── Unauthenticated ─────────────────────────────────────────

	describe("unauthenticated requests", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "POST",
				url: SEND_URL,
				payload: { email: "test@example.com" },
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});

		it("returns 401 when session is not found in Redis", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const response = await app.inject({
				method: "POST",
				url: SEND_URL,
				payload: { email: "test@example.com" },
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(401);
		});
	});

	// ── Rate limited ────────────────────────────────────────────

	describe("rate limited", () => {
		it("returns 429 when rate limited", async () => {
			setupAuthenticatedSession(app);
			mockSendVerificationEmail.mockRejectedValue(
				new RateLimitError(
					"Please wait before requesting another verification email",
					{ retryAfterSeconds: 60 },
				),
			);

			const response = await app.inject(
				buildAuthenticatedRequest(SEND_URL, {
					email: "test@example.com",
				}),
			);

			expect(response.statusCode).toBe(429);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "RATE_LIMITED",
					details: { retryAfterSeconds: 60 },
				},
			});
		});
	});

	// ── Validation errors ───────────────────────────────────────

	describe("validation errors", () => {
		it("returns 400 when email is missing", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(
				buildAuthenticatedRequest(SEND_URL, {}),
			);

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when email is invalid", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(
				buildAuthenticatedRequest(SEND_URL, {
					email: "not-an-email",
				}),
			);

			expect(response.statusCode).toBe(400);
		});

		it("does not call the service for invalid input", async () => {
			setupAuthenticatedSession(app);

			await app.inject(
				buildAuthenticatedRequest(SEND_URL, {
					email: "not-an-email",
				}),
			);

			expect(mockSendVerificationEmail).not.toHaveBeenCalled();
		});
	});

	// ── CSRF validation ─────────────────────────────────────────

	describe("CSRF validation", () => {
		it("returns 403 when CSRF cookie and header are missing", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject({
				method: "POST",
				url: SEND_URL,
				payload: { email: "test@example.com" },
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});
});

describe("POST /api/v1/auth/email/verify", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockSendVerificationEmail.mockReset();
		mockVerifyEmailToken.mockReset();
		mockSendOtpForPhone.mockReset();
		mockVerifyOtpAndCreateSession.mockReset();
		mockLogoutSession.mockReset();
		getSessionRedisMock(app).mockReset();
	});

	// ── Happy path ──────────────────────────────────────────────

	describe("happy path", () => {
		it("returns 200 with role elevated to organizer", async () => {
			setupAuthenticatedSession(app);
			mockVerifyEmailToken.mockResolvedValue({
				role: "organizer",
				email: "test@example.com",
			});

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: VALID_TOKEN }),
			);

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					role: "organizer",
					email: "test@example.com",
					message: "Email verified successfully",
				},
			});
		});

		it("passes correct deps and token to service", async () => {
			setupAuthenticatedSession(app);
			mockVerifyEmailToken.mockResolvedValue({
				role: "organizer",
				email: "test@example.com",
			});

			await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: VALID_TOKEN }),
			);

			expect(mockVerifyEmailToken).toHaveBeenCalledOnce();
			const [deps, token, sessionInfo] =
				mockVerifyEmailToken.mock.calls[0]!;
			expect(deps).toHaveProperty("db");
			expect(deps).toHaveProperty("sessionRedis");
			expect(deps).toHaveProperty("log");
			expect(token).toBe(VALID_TOKEN);
			expect(sessionInfo).toEqual({
				userId: "user-001",
				sessionId: TEST_SESSION_ID,
			});
		});
	});

	// ── Unauthenticated ─────────────────────────────────────────

	describe("unauthenticated requests", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { token: VALID_TOKEN },
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});
	});

	// ── Invalid/expired token ───────────────────────────────────

	describe("invalid or expired token", () => {
		it("returns 400 when token is invalid or expired", async () => {
			setupAuthenticatedSession(app);
			mockVerifyEmailToken.mockRejectedValue(
				new ValidationError("Invalid or expired verification token"),
			);

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: VALID_TOKEN }),
			);

			expect(response.statusCode).toBe(400);
			expect(response.json()).toMatchObject({
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid or expired verification token",
				},
			});
		});

		it("returns 400 when token was already used", async () => {
			setupAuthenticatedSession(app);
			mockVerifyEmailToken.mockRejectedValue(
				new ValidationError("Invalid or expired verification token"),
			);

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: VALID_TOKEN }),
			);

			expect(response.statusCode).toBe(400);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "VALIDATION_ERROR" },
			});
		});
	});

	// ── Validation errors ───────────────────────────────────────

	describe("validation errors", () => {
		it("returns 400 when token is missing", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, {}),
			);

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when token is too short", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: "abc123" }),
			);

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when token has invalid characters", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, {
					token: "g".repeat(64), // 'g' is not valid hex
				}),
			);

			expect(response.statusCode).toBe(400);
		});

		it("does not call the service for invalid input", async () => {
			setupAuthenticatedSession(app);

			await app.inject(
				buildAuthenticatedRequest(VERIFY_URL, { token: "short" }),
			);

			expect(mockVerifyEmailToken).not.toHaveBeenCalled();
		});
	});

	// ── CSRF validation ─────────────────────────────────────────

	describe("CSRF validation", () => {
		it("returns 403 when CSRF cookie and header are missing", async () => {
			setupAuthenticatedSession(app);

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { token: VALID_TOKEN },
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "CSRF_VALIDATION_FAILED" },
			});
		});
	});
});
