import { beforeEach, describe, expect, it, vi } from "vitest";

describe("otel", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("initTelemetry returns a handle with SDK when no Sentry DSN", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
		});
		expect(handle).toBeDefined();
		expect(handle.sdk).not.toBeNull();
		expect(handle.meterProvider).toBeNull();
		await handle.sdk!.shutdown();
	}, 15_000);

	it("initTelemetry configures metrics reader when OTLP endpoint is set", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		});
		expect(handle.sdk).not.toBeNull();
		await handle.sdk!.shutdown();
	}, 15_000);

	it("initTelemetry parses OTEL headers correctly", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			OTEL_SERVICE_NAME: "test-service",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
			OTEL_EXPORTER_OTLP_HEADERS:
				"Authorization=Bearer token123,X-Custom=value",
		});
		expect(handle.sdk).not.toBeNull();
		await handle.sdk!.shutdown();
	}, 15_000);

	it("initTelemetry uses default service name when not provided", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({});
		expect(handle.sdk).not.toBeNull();
		await handle.sdk!.shutdown();
	}, 15_000);

	it("initTelemetry returns null SDK when SENTRY_DSN is set", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
		});
		expect(handle.sdk).toBeNull();
	});

	it("initTelemetry creates standalone MeterProvider when Sentry + OTLP endpoint", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		});
		expect(handle.sdk).toBeNull();
		expect(handle.meterProvider).not.toBeNull();
		await handle.meterProvider!.shutdown();
	}, 15_000);

	it("initTelemetry respects custom metrics export interval", async () => {
		const { initTelemetry } = await import("../../src/lib/otel.js");
		const handle = initTelemetry({
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
			OTEL_METRICS_EXPORT_INTERVAL_MS: 10_000,
		});
		expect(handle.sdk).not.toBeNull();
		await handle.sdk!.shutdown();
	}, 15_000);

	it("shutdownTelemetry handles SDK handle", async () => {
		const { initTelemetry, shutdownTelemetry } = await import(
			"../../src/lib/otel.js"
		);
		const handle = initTelemetry({});
		await expect(shutdownTelemetry(handle)).resolves.toBeUndefined();
	}, 15_000);

	it("shutdownTelemetry handles MeterProvider handle", async () => {
		const { initTelemetry, shutdownTelemetry } = await import(
			"../../src/lib/otel.js"
		);
		const handle = initTelemetry({
			SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		});
		await expect(shutdownTelemetry(handle)).resolves.toBeUndefined();
	}, 15_000);

	it("shutdownTelemetry is a no-op when both null", async () => {
		const { shutdownTelemetry } = await import("../../src/lib/otel.js");
		await expect(
			shutdownTelemetry({ sdk: null, meterProvider: null }),
		).resolves.toBeUndefined();
	});
});
