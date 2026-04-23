import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";

interface OTelConfig {
	OTEL_SERVICE_NAME?: string;
	OTEL_EXPORTER_OTLP_ENDPOINT?: string;
	OTEL_EXPORTER_OTLP_HEADERS?: string;
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

export function initTelemetry(config: OTelConfig): NodeSDK {
	const serviceName = config.OTEL_SERVICE_NAME ?? "eventkart-api";

	let traceExporter: OTLPTraceExporter | undefined;
	if (config.OTEL_EXPORTER_OTLP_ENDPOINT) {
		const headers = config.OTEL_EXPORTER_OTLP_HEADERS
			? parseHeaders(config.OTEL_EXPORTER_OTLP_HEADERS)
			: undefined;

		traceExporter = new OTLPTraceExporter({
			url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
			headers,
		});
	}

	const sdk = new NodeSDK({
		serviceName,
		traceExporter,
		instrumentations: [
			new HttpInstrumentation(),
			new FastifyInstrumentation(),
			new PinoInstrumentation(),
		],
	});

	sdk.start();

	return sdk;
}

export async function shutdownTelemetry(sdk: NodeSDK): Promise<void> {
	try {
		await sdk.shutdown();
	} catch (error) {
		console.error("Error shutting down OpenTelemetry SDK:", error);
	}
}
