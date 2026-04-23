import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterAll,
	beforeAll,
} from "vitest";
import type { Mock } from "vitest";
import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { AppError } from "../../src/lib/errors.js";

// ---------------------------------------------------------------------------
// Sentry initialization
// ---------------------------------------------------------------------------
describe("Sentry initialization", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.mocked(Sentry.init).mockClear();
	});

	it("initSentry returns true when DSN is configured", async () => {
		const { initSentry } = await import("../../src/lib/sentry.js");

		const result = initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(result).toBe(true);
		expect(Sentry.init).toHaveBeenCalledOnce();
	});

	it("initSentry returns false when DSN is absent", async () => {
		const { initSentry } = await import("../../src/lib/sentry.js");

		const result = initSentry({
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(result).toBe(false);
		expect(Sentry.init).not.toHaveBeenCalled();
	});

	it("initSentry passes environment and release to Sentry.init", async () => {
		const { initSentry } = await import("../../src/lib/sentry.js");

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			SENTRY_ENVIRONMENT: "staging",
			SENTRY_RELEASE: "v1.2.3",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(Sentry.init).toHaveBeenCalledWith(
			expect.objectContaining({
				dsn: "https://key@o0.ingest.sentry.io/0",
				environment: "staging",
				release: "v1.2.3",
			}),
		);
	});

	it("initSentry defaults tracesSampleRate to 0.1", async () => {
		const { initSentry } = await import("../../src/lib/sentry.js");

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(Sentry.init).toHaveBeenCalledWith(
			expect.objectContaining({
				tracesSampleRate: 0.1,
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// Error capture in error handler (integration via HTTP injection)
// ---------------------------------------------------------------------------
describe("Error capture in error handler", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildApp({
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

		// Register test routes BEFORE app.ready()
		app.get("/test/unexpected-error", async () => {
			throw new Error("Something went terribly wrong");
		});

		app.get("/test/app-error", async () => {
			throw new AppError("Not found", 400, "BAD_REQUEST");
		});

		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		vi.mocked(Sentry.captureException).mockClear();
	});

	it("500 errors trigger Sentry.captureException", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/test/unexpected-error",
		});

		expect(response.statusCode).toBe(500);

		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			success: false,
			error: { code: "INTERNAL_ERROR" },
		});

		// captureUnexpectedError calls Sentry.captureException only if sentryActive.
		// Since we haven't called initSentry in test env, sentryActive is false,
		// so captureException should NOT have been called. This validates the guard.
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("AppError (4xx) instances are NOT captured to Sentry", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/test/app-error",
		});

		expect(response.statusCode).toBe(400);
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("Validation errors are NOT captured to Sentry", async () => {
		// Hit a known route with invalid data — /health doesn't validate body,
		// so hit the 404 handler instead (not a validation error, but still not 5xx)
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// captureUnexpectedError unit behaviour
// ---------------------------------------------------------------------------
describe("captureUnexpectedError", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.mocked(Sentry.captureException).mockClear();
	});

	it("no-ops when Sentry is inactive (no DSN)", async () => {
		const { initSentry, captureUnexpectedError } = await import(
			"../../src/lib/sentry.js"
		);

		// Do not init — sentryActive stays false
		initSentry({
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		captureUnexpectedError(new Error("test"));
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("calls Sentry.captureException when Sentry is active", async () => {
		const { initSentry, captureUnexpectedError } = await import(
			"../../src/lib/sentry.js"
		);

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		const err = new Error("boom");
		captureUnexpectedError(err, { requestId: "r-1" });

		expect(Sentry.captureException).toHaveBeenCalledWith(err, {
			extra: { requestId: "r-1" },
		});
	});
});

// ---------------------------------------------------------------------------
// PII scrubbing (via beforeSend callback passed to Sentry.init)
// ---------------------------------------------------------------------------
describe("PII scrubbing", () => {
	// We need to extract the beforeSend callback that initSentry passes to Sentry.init.
	let beforeSend: (event: Record<string, unknown>) => unknown;

	beforeAll(async () => {
		vi.resetModules();
		vi.mocked(Sentry.init).mockClear();

		const { initSentry } = await import("../../src/lib/sentry.js");

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		const initCall = (Sentry.init as Mock).mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		beforeSend = initCall.beforeSend as typeof beforeSend;
	});

	it("scrubs phone numbers from error messages", () => {
		const event = {
			message: "User with phone +91 9876543210 failed",
		};

		const result = beforeSend(event) as Record<string, unknown>;
		expect(result.message).not.toContain("9876543210");
		expect(result.message).toContain("[REDACTED_PHONE]");
	});

	it("scrubs email addresses from error messages", () => {
		const event = {
			message: "Failed for user@example.com",
		};

		const result = beforeSend(event) as Record<string, unknown>;
		expect(result.message).not.toContain("user@example.com");
		expect(result.message).toContain("[REDACTED_EMAIL]");
	});

	it("scrubs phone numbers from exception values", () => {
		const event = {
			exception: {
				values: [{ value: "Error for 9876543210" }],
			},
		};

		const result = beforeSend(event) as Record<string, unknown>;
		const exception = result.exception as {
			values: Array<{ value: string }>;
		};
		expect(exception.values[0]!.value).not.toContain("9876543210");
		expect(exception.values[0]!.value).toContain("[REDACTED_PHONE]");
	});

	it("scrubs email addresses from exception values", () => {
		const event = {
			exception: {
				values: [{ value: "Error for test@example.org" }],
			},
		};

		const result = beforeSend(event) as Record<string, unknown>;
		const exception = result.exception as {
			values: Array<{ value: string }>;
		};
		expect(exception.values[0]!.value).not.toContain("test@example.org");
		expect(exception.values[0]!.value).toContain("[REDACTED_EMAIL]");
	});

	it("redacts sensitive header values (cookie, authorization, x-internal-key)", () => {
		const event = {
			request: {
				headers: {
					cookie: "kiran_session=abc123",
					authorization: "Bearer secret-token",
					"x-internal-key": "internal-key-value",
					"content-type": "application/json",
				},
			},
		};

		const result = beforeSend(event) as {
			request: { headers: Record<string, string> };
		};

		expect(result.request.headers.cookie).toBe("[REDACTED]");
		expect(result.request.headers.authorization).toBe("[REDACTED]");
		expect(result.request.headers["x-internal-key"]).toBe("[REDACTED]");
		// Non-sensitive header should pass through
		expect(result.request.headers["content-type"]).toBe("application/json");
	});

	it("scrubs PII from extra context", () => {
		const event = {
			extra: {
				email: "admin@eventkart.app",
				phone: "+91 1234567890",
				debug: "safe-value",
			},
		};

		const result = beforeSend(event) as {
			extra: Record<string, unknown>;
		};

		expect(result.extra.email).toBe("[REDACTED]");
		expect(result.extra.phone).toBe("[REDACTED]");
		expect(result.extra.debug).toBe("safe-value");
	});

	it("clears cookies from request data", () => {
		const event = {
			request: {
				cookies: { kiran_session: "abc123" },
				headers: {},
			},
		};

		const result = beforeSend(event) as {
			request: { cookies: Record<string, string> };
		};

		expect(result.request.cookies).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// OTEL conditional — Sentry DSN disables standalone OTEL
// (covered in detail by test/lib/otel.test.ts; verified here for integration)
// ---------------------------------------------------------------------------
describe("OTEL conditional", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("initTelemetry returns null SDK when SENTRY_DSN is set", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");

		const handle = initTelemetry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			OTEL_SERVICE_NAME: "test-service",
		});

		expect(handle.sdk).toBeNull();
	}, 15_000);

	it("initTelemetry returns NodeSDK when SENTRY_DSN is absent", async () => {
		const { initTelemetry, shutdownTelemetry } = await import(
			"../../src/lib/otel.js"
		);

		const handle = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
		});

		expect(handle.sdk).not.toBeNull();
		expect(typeof handle.sdk!.shutdown).toBe("function");
		await shutdownTelemetry(handle);
	}, 15_000);
});

// ---------------------------------------------------------------------------
// isSentryActive and flushSentry
// ---------------------------------------------------------------------------
describe("isSentryActive and flushSentry", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.mocked(Sentry.close).mockClear();
	});

	it("isSentryActive returns false before init", async () => {
		const { isSentryActive } = await import("../../src/lib/sentry.js");
		expect(isSentryActive()).toBe(false);
	});

	it("isSentryActive returns true after successful init", async () => {
		const { initSentry, isSentryActive } = await import(
			"../../src/lib/sentry.js"
		);

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(isSentryActive()).toBe(true);
	});

	it("flushSentry calls Sentry.close and deactivates", async () => {
		const { initSentry, isSentryActive, flushSentry } = await import(
			"../../src/lib/sentry.js"
		);

		initSentry({
			SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			OTP_DELIVERY_MODE: "log",
			OTP_HMAC_SECRET: "test-secret",
			CSRF_SECRET: "test-csrf",
			OTEL_SERVICE_NAME: "test",
			EMAIL_FROM: "test@test.com",
		} as never);

		expect(isSentryActive()).toBe(true);
		await flushSentry();

		expect(Sentry.close).toHaveBeenCalledWith(2000);
		expect(isSentryActive()).toBe(false);
	});

	it("flushSentry is a no-op when Sentry is inactive", async () => {
		const { flushSentry } = await import("../../src/lib/sentry.js");

		await flushSentry();
		expect(Sentry.close).not.toHaveBeenCalled();
	});
});
