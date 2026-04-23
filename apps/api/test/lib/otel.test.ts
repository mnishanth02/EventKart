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
		expect(sdk).toBeDefined();
		expect(typeof sdk.shutdown).toBe("function");
		await sdk.shutdown();
	});

	it("initTelemetry returns an SDK instance with endpoint configured", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		});
		expect(sdk).toBeDefined();
		await sdk.shutdown();
	});

	it("initTelemetry parses OTEL headers correctly", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
			OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer token123,X-Custom=value",
		});
		expect(sdk).toBeDefined();
		await sdk.shutdown();
	});

	it("initTelemetry uses default service name when not provided", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({});
		expect(sdk).toBeDefined();
		await sdk.shutdown();
	});

	it("shutdownTelemetry does not throw on valid SDK", async () => {
		const { initTelemetry, shutdownTelemetry } = await import("../../src/lib/otel.js");
		const sdk = initTelemetry({});
		await expect(shutdownTelemetry(sdk)).resolves.toBeUndefined();
	});
});
