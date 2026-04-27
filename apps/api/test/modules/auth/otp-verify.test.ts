import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Mock the auth service module to control verifyOtpAndCreateSession
const mockVerifyOtpAndCreateSession = vi.fn();
const mockSendOtpForPhone = vi.fn();

vi.mock("../../../src/modules/auth/service.js", () => ({
	sendOtpForPhone: (...args: unknown[]) => mockSendOtpForPhone(...args),
	verifyOtpAndCreateSession: (...args: unknown[]) =>
		mockVerifyOtpAndCreateSession(...args),
}));

import type { FastifyInstance } from "fastify";
import {
	OtpExpiredError,
	OtpInvalidError,
	OtpMaxAttemptsError,
} from "../../../src/lib/errors.js";
import { buildTestApp } from "../../helpers/build-app.js";

const VERIFY_URL = "/api/v1/auth/otp/verify";
const VALID_HEADERS = { origin: "http://localhost:3000" };

function parseCookies(setCookieHeader: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const parts = setCookieHeader.split(";").map((s) => s.trim());
	for (const part of parts) {
		const [key, ...rest] = part.split("=");
		if (!key) continue;
		attrs[key.toLowerCase()] = rest.join("=");
	}
	return attrs;
}

/** Find a specific cookie string from set-cookie header (may be string or string[]) */
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

describe("POST /api/v1/auth/otp/verify", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		mockVerifyOtpAndCreateSession.mockReset();
		mockSendOtpForPhone.mockReset();
	});

	// ── Happy path — new user ────────────────────────────────────

	describe("happy path — new user", () => {
		it("returns 200 with user data for a valid OTP", async () => {
			mockVerifyOtpAndCreateSession.mockResolvedValue({
				sessionId: "test-session-id",
				userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				role: "participant",
				isNewUser: true,
			});

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "123456" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					role: "participant",
					isNewUser: true,
				},
			});
		});

		it("sets the kiran_session cookie with correct options", async () => {
			mockVerifyOtpAndCreateSession.mockResolvedValue({
				sessionId: "test-session-id",
				userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				role: "participant",
				isNewUser: true,
			});

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "123456" },
			});

			const setCookieRaw = response.headers["set-cookie"];
			const sessionCookie = findCookie(setCookieRaw, "kiran_session");
			expect(sessionCookie).toBeDefined();
			if (!sessionCookie) {
				throw new Error("Expected kiran_session cookie to be set");
			}

			const cookie = parseCookies(sessionCookie);
			expect(cookie.kiran_session).toBe("test-session-id");
			expect(cookie).toHaveProperty("httponly");
			expect(cookie.samesite).toBe("Lax");
			expect(cookie.path).toBe("/");
		});

		it("passes phone and otp to the service function", async () => {
			mockVerifyOtpAndCreateSession.mockResolvedValue({
				sessionId: "test-session-id",
				userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				role: "participant",
				isNewUser: true,
			});

			await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "654321" },
			});

			expect(mockVerifyOtpAndCreateSession).toHaveBeenCalledOnce();
			const firstCall = mockVerifyOtpAndCreateSession.mock.calls[0];
			expect(firstCall).toBeDefined();
			if (!firstCall) {
				throw new Error("Expected verifyOtpAndCreateSession to be called");
			}
			const [_deps, phone, otp] = firstCall;
			expect(phone).toBe("+919876543210");
			expect(otp).toBe("654321");
		});
	});

	// ── Happy path — existing user ───────────────────────────────

	describe("happy path — existing user", () => {
		it("returns 200 with isNewUser false and organizer role", async () => {
			mockVerifyOtpAndCreateSession.mockResolvedValue({
				sessionId: "existing-session-id",
				userId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
				role: "organizer",
				isNewUser: false,
			});

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "8765432109", otp: "111111" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: {
					userId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
					role: "organizer",
					isNewUser: false,
				},
			});
		});
	});

	// ── Validation errors (400) ──────────────────────────────────

	describe("validation errors", () => {
		it("returns 400 when phone is missing", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { otp: "123456" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when otp is missing", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "9876543210" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when otp is too short (5 digits)", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "9876543210", otp: "12345" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when otp is too long (7 digits)", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "9876543210", otp: "1234567" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 when otp contains non-digit characters", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "9876543210", otp: "12ab56" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for a non-Indian phone number", async () => {
			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "+14155552671", otp: "123456" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("does not call the service for invalid input", async () => {
			await app.inject({
				method: "POST",
				url: VERIFY_URL,
				payload: { phone: "9876543210", otp: "short" },
			});

			expect(mockVerifyOtpAndCreateSession).not.toHaveBeenCalled();
		});
	});

	// ── OTP expired (400) ────────────────────────────────────────

	describe("OTP expired", () => {
		it("returns 400 with OTP_EXPIRED code", async () => {
			mockVerifyOtpAndCreateSession.mockRejectedValue(new OtpExpiredError());

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "123456" },
			});

			expect(response.statusCode).toBe(400);

			const body = response.json();
			expect(body).toMatchObject({
				success: false,
				error: {
					code: "OTP_EXPIRED",
				},
			});
		});
	});

	// ── OTP invalid (400) ────────────────────────────────────────

	describe("OTP invalid", () => {
		it("returns 400 with OTP_INVALID code and attemptsRemaining", async () => {
			mockVerifyOtpAndCreateSession.mockRejectedValue(new OtpInvalidError(3));

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "999999" },
			});

			expect(response.statusCode).toBe(400);

			const body = response.json();
			expect(body).toMatchObject({
				success: false,
				error: {
					code: "OTP_INVALID",
					details: { attemptsRemaining: 3 },
				},
			});
		});

		it("returns correct remaining attempts when only 1 left", async () => {
			mockVerifyOtpAndCreateSession.mockRejectedValue(new OtpInvalidError(1));

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "000000" },
			});

			expect(response.statusCode).toBe(400);

			const body = response.json();
			expect(body.error.details).toHaveProperty("attemptsRemaining", 1);
		});
	});

	// ── Max attempts exceeded (429) ──────────────────────────────

	describe("max attempts exceeded", () => {
		it("returns 429 with OTP_MAX_ATTEMPTS_EXCEEDED code", async () => {
			mockVerifyOtpAndCreateSession.mockRejectedValue(
				new OtpMaxAttemptsError(),
			);

			const response = await app.inject({
				method: "POST",
				url: VERIFY_URL,
				headers: VALID_HEADERS,
				payload: { phone: "9876543210", otp: "123456" },
			});

			expect(response.statusCode).toBe(429);

			const body = response.json();
			expect(body).toMatchObject({
				success: false,
				error: {
					code: "OTP_MAX_ATTEMPTS_EXCEEDED",
				},
			});
		});
	});
});
