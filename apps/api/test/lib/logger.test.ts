import { describe, expect, it } from "vitest";
import { createLoggerOptions } from "../../src/lib/logger.js";

describe("createLoggerOptions", () => {
	const baseConfig = {
		LOG_LEVEL: "info" as const,
		OTEL_SERVICE_NAME: "test-service",
	};

	it("returns options with the configured log level", () => {
		const options = createLoggerOptions(baseConfig);
		expect(options).toHaveProperty("level", "info");
	});

	it("returns options with a different log level", () => {
		const options = createLoggerOptions({ ...baseConfig, LOG_LEVEL: "debug" });
		expect(options).toHaveProperty("level", "debug");
	});

	it("includes redaction paths for sensitive fields", () => {
		const options = createLoggerOptions(baseConfig);
		// options is an object with redact field
		const redact = (options as Record<string, unknown>).redact as {
			paths: string[];
			censor: string;
		};
		expect(redact).toBeDefined();
		expect(redact.paths).toContain("req.headers.authorization");
		expect(redact.paths).toContain("req.headers.cookie");
		expect(redact.paths).toContain("req.headers['x-internal-key']");
		expect(redact.paths).toContain("password");
		expect(redact.paths).toContain("token");
		expect(redact.paths).toContain("secret");
		expect(redact.paths).toContain("creditCard");
		expect(redact.censor).toBe("[REDACTED]");
	});

	it("does not redact otp field (needed for dev OTP logging)", () => {
		const options = createLoggerOptions(baseConfig);
		const redact = (options as Record<string, unknown>).redact as {
			paths: string[];
		};
		expect(redact.paths).not.toContain("otp");
	});

	it("includes custom serializers for req and res", () => {
		const options = createLoggerOptions(baseConfig);
		const serializers = (options as Record<string, unknown>)
			.serializers as Record<string, unknown>;
		expect(serializers).toBeDefined();
		expect(typeof serializers.req).toBe("function");
		expect(typeof serializers.res).toBe("function");
	});

	it("req serializer whitelists safe fields only", () => {
		const options = createLoggerOptions(baseConfig);
		const serializers = (options as Record<string, unknown>)
			.serializers as Record<
			string,
			((...args: unknown[]) => unknown) | undefined
		>;
		const mockReq = {
			method: "GET",
			url: "/api/v1/test",
			hostname: "localhost",
			ip: "127.0.0.1",
			socket: { remotePort: 54321 },
			headers: { authorization: "Bearer secret", cookie: "session=abc" },
			body: { password: "secret123" },
		};
		const reqSerializer = serializers.req;
		expect(reqSerializer).toBeDefined();
		const result = reqSerializer?.(mockReq) as Record<string, unknown>;
		expect(result).toEqual({
			method: "GET",
			url: "/api/v1/test",
			hostname: "localhost",
			remoteAddress: "127.0.0.1",
			remotePort: 54321,
		});
		// Should NOT contain headers or body
		expect(result).not.toHaveProperty("headers");
		expect(result).not.toHaveProperty("body");
	});

	it("res serializer returns only statusCode", () => {
		const options = createLoggerOptions(baseConfig);
		const serializers = (options as Record<string, unknown>)
			.serializers as Record<
			string,
			((...args: unknown[]) => unknown) | undefined
		>;
		const mockRes = {
			statusCode: 200,
			headers: { "set-cookie": "session=abc" },
		};
		const resSerializer = serializers.res;
		expect(resSerializer).toBeDefined();
		const result = resSerializer?.(mockRes) as Record<string, unknown>;
		expect(result).toEqual({ statusCode: 200 });
		expect(result).not.toHaveProperty("headers");
	});

	it("uses string level labels instead of numbers", () => {
		const options = createLoggerOptions(baseConfig);
		const formatters = (options as Record<string, unknown>)
			.formatters as Record<
			string,
			((...args: unknown[]) => unknown) | undefined
		>;
		const levelFormatter = formatters.level;
		expect(levelFormatter).toBeDefined();
		expect(levelFormatter?.("info")).toEqual({ level: "info" });
		expect(levelFormatter?.("error")).toEqual({ level: "error" });
	});

	it("includes ISO timestamp formatter", () => {
		const options = createLoggerOptions(baseConfig);
		const timestamp = (options as Record<string, unknown>)
			.timestamp as () => string;
		expect(typeof timestamp).toBe("function");
		const result = timestamp();
		expect(result).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T/);
	});

	it("includes service name in base", () => {
		const options = createLoggerOptions(baseConfig);
		const base = (options as Record<string, unknown>).base as Record<
			string,
			unknown
		>;
		expect(base).toEqual({ service: "test-service" });
	});

	it("does not include transport when LOG_PRETTY is not set", () => {
		const options = createLoggerOptions(baseConfig);
		expect(options).not.toHaveProperty("transport");
	});

	it("does not include transport when LOG_PRETTY is false", () => {
		const options = createLoggerOptions({ ...baseConfig, LOG_PRETTY: false });
		expect(options).not.toHaveProperty("transport");
	});

	it("includes pino-pretty transport when LOG_PRETTY is true", () => {
		const options = createLoggerOptions({ ...baseConfig, LOG_PRETTY: true });
		const transport = (options as Record<string, unknown>).transport as {
			target: string;
			options: Record<string, unknown>;
		};
		expect(transport).toBeDefined();
		expect(transport.target).toBe("pino-pretty");
		expect(transport.options.colorize).toBe(true);
	});
});
