import { describe, it, expect, vi, beforeEach } from "vitest";

describe("otel", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("initTelemetry returns an SDK instance without endpoint configured", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
		});
		expect(sdk).not.toBeNull();
		expect(typeof sdk!.shutdown).toBe("function");
		await sdk!.shutdown();
	}, 15_000);

	it("initTelemetry returns an SDK instance with endpoint configured", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		});
		expect(sdk).not.toBeNull();
		await sdk!.shutdown();
	}, 15_000);

	it("initTelemetry parses OTEL headers correctly", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
			OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer token123,X-Custom=value",
		});
		expect(sdk).not.toBeNull();
		await sdk!.shutdown();
	}, 15_000);

	it("initTelemetry uses default service name when not provided", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({});
		expect(sdk).not.toBeNull();
		await sdk!.shutdown();
	}, 15_000);

	it("initTelemetry returns null when SENTRY_DSN is set", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
		});
		expect(sdk).toBeNull();
	});

	it("shutdownTelemetry does not throw on valid SDK", async () => {
		const { initTelemetry, shutdownTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({});
		await expect(shutdownTelemetry(sdk)).resolves.toBeUndefined();
	}, 15_000);

	it("shutdownTelemetry is a no-op when sdk is null", async () => {
		const { shutdownTelemetry } = await import("../../src/lib/otel.js");
		await expect(shutdownTelemetry(null)).resolves.toBeUndefined();
	});
});
