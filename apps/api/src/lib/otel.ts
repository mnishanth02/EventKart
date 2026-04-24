import { metrics } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";

const DEFAULT_METRICS_EXPORT_INTERVAL_MS = 60_000;

interface OTelConfig {
	SENTRY_DSN?: string;
	OTEL_SERVICE_NAME?: string;
	OTEL_EXPORTER_OTLP_ENDPOINT?: string;
	OTEL_EXPORTER_OTLP_HEADERS?: string;
	OTEL_METRICS_EXPORT_INTERVAL_MS?: number;
}

export interface TelemetryHandle {
	sdk: NodeSDK | null;
	meterProvider: MeterProvider | null;
}

function parseHeaders(
	headerString: string,
): Record<string, string> | undefined {
	const headers: Record<string, string> = {};
	for (const pair of headerString.split(",")) {
		const separatorIndex = pair.indexOf("=");
		if (separatorIndex > 0) {
			const key = pair.slice(0, separatorIndex).trim();
			const value = pair.slice(separatorIndex + 1).trim();
			if (key && value) {
				headers[key] = value;
			}
		}
	}
	return Object.keys(headers).length > 0 ? headers : undefined;
}

function buildMetricReader(
	config: OTelConfig,
): PeriodicExportingMetricReader | undefined {
	if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) {
		return undefined;
	}

	const headers = config.OTEL_EXPORTER_OTLP_HEADERS
		? parseHeaders(config.OTEL_EXPORTER_OTLP_HEADERS)
		: undefined;

	const exporter = new OTLPMetricExporter({
		url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
		headers,
	});

	return new PeriodicExportingMetricReader({
		exporter,
		exportIntervalMillis:
			config.OTEL_METRICS_EXPORT_INTERVAL_MS ??
			DEFAULT_METRICS_EXPORT_INTERVAL_MS,
	});
}

export function initTelemetry(config: OTelConfig): TelemetryHandle {
	const serviceName = config.OTEL_SERVICE_NAME ?? "eventkart-api";
	const resource = resourceFromAttributes({ "service.name": serviceName });
	const metricReader = buildMetricReader(config);

	// When Sentry is active it manages OpenTelemetry tracing (HTTP, Fastify,
	// Pino instrumentations) — skip manual trace setup to avoid duplicate
	// spans. Metrics always use our own MeterProvider since Sentry does not
	// export custom OTEL metrics.
	if (config.SENTRY_DSN) {
		let meterProvider: MeterProvider | null = null;

		if (metricReader) {
			meterProvider = new MeterProvider({
				resource,
				readers: [metricReader],
			});
			metrics.setGlobalMeterProvider(meterProvider);
		}

		return { sdk: null, meterProvider };
	}

	// No Sentry — full OTEL SDK with tracing + metrics
	const headers = config.OTEL_EXPORTER_OTLP_HEADERS
		? parseHeaders(config.OTEL_EXPORTER_OTLP_HEADERS)
		: undefined;

	let traceExporter: OTLPTraceExporter | undefined;
	if (config.OTEL_EXPORTER_OTLP_ENDPOINT) {
		traceExporter = new OTLPTraceExporter({
			url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
			headers,
		});
	}

	const sdk = new NodeSDK({
		serviceName,
		resource,
		traceExporter,
		metricReader,
		instrumentations: [
			new HttpInstrumentation(),
			new FastifyInstrumentation(),
			new PinoInstrumentation(),
		],
	});

	sdk.start();

	return { sdk, meterProvider: null };
}

export async function shutdownTelemetry(
	handle: TelemetryHandle,
): Promise<void> {
	const shutdowns: Promise<void>[] = [];

	if (handle.sdk) {
		shutdowns.push(handle.sdk.shutdown());
	}

	if (handle.meterProvider) {
		shutdowns.push(handle.meterProvider.shutdown());
	}

	if (shutdowns.length === 0) {
		return;
	}

	try {
		await Promise.all(shutdowns);
	} catch (error) {
		console.error("Error shutting down OpenTelemetry:", error);
	}
}
