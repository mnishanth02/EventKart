import type { FastifyInstance } from "fastify";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { buildTestApp } from "../../helpers/build-app.js";

describe("POST /api/v1/auth/otp/send", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		// Reset the otp redis mock defaults between tests
		vi.mocked(app.redis.otp.set).mockResolvedValue("OK");
		vi.mocked(app.redis.otp.ttl).mockResolvedValue(-2);
	});

	// ── Happy path ────────────────────────────────────────────────

	it("returns 200 with success payload for a valid 10-digit phone", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/v1/auth/otp/send",
			payload: { phone: "9876543210" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: {
				message: "OTP sent successfully",
				expiresInSeconds: 300,
			},
		});
	});

	it("calls redis pipeline to store the OTP", async () => {
		const pipelineSpy = vi.mocked(app.redis.otp.pipeline);

		await app.inject({
			method: "POST",
			url: "/api/v1/auth/otp/send",
			payload: { phone: "9876543210" },
		});

		expect(pipelineSpy).toHaveBeenCalled();
	});

	// ── Phone normalization ───────────────────────────────────────

	describe("phone normalization", () => {
		it.each([
			{ label: "+91 prefix", phone: "+919876543210" },
			{ label: "91 prefix (no plus)", phone: "919876543210" },
			{ label: "leading zero", phone: "09876543210" },
			{ label: "bare 10 digits", phone: "9876543210" },
		])("accepts $label ($phone) and returns 200", async ({ phone }) => {
			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({ success: true });
		});
	});

	// ── Validation errors (400) ───────────────────────────────────

	describe("validation errors", () => {
		it("returns 400 when phone field is missing", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: {},
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for an empty string phone", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for a number not starting with 6-9", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "1234567890" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns 400 for a non-Indian number", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "+14155552671" },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	// ── OTP rate limit (429) ──────────────────────────────────────

	describe("OTP cooldown rate limit", () => {
		it("returns 429 with OTP_RATE_LIMITED when cooldown is active", async () => {
			// Mock set to return null — simulates NX failing (key already exists)
			vi.mocked(app.redis.otp.set).mockResolvedValue(null);
			vi.mocked(app.redis.otp.ttl).mockResolvedValue(45);

			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "9876543210" },
			});

			expect(response.statusCode).toBe(429);

			const body = response.json();
			expect(body).toMatchObject({
				success: false,
				error: {
					code: "OTP_RATE_LIMITED",
					message: "Please wait before requesting another OTP",
				},
			});
			expect(body.error.details).toHaveProperty("retryAfterSeconds", 45);
		});

		it("returns retryAfterSeconds of 0 when TTL has expired", async () => {
			vi.mocked(app.redis.otp.set).mockResolvedValue(null);
			vi.mocked(app.redis.otp.ttl).mockResolvedValue(-2);

			const response = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "9876543210" },
			});

			expect(response.statusCode).toBe(429);

			const body = response.json();
			expect(body.error.details).toHaveProperty("retryAfterSeconds", 0);
		});
	});

	// ── Multiple sequential sends ─────────────────────────────────

	describe("multiple sends", () => {
		it("allows consecutive requests when mock set returns OK", async () => {
			const first = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "9876543210" },
			});

			const second = await app.inject({
				method: "POST",
				url: "/api/v1/auth/otp/send",
				payload: { phone: "8765432109" },
			});

			expect(first.statusCode).toBe(200);
			expect(second.statusCode).toBe(200);
		});
	});
});
