// Sentry must init first — it takes over OpenTelemetry when active

import { loadConfig } from "./lib/config.js";
import { initTelemetry, shutdownTelemetry } from "./lib/otel.js";
import {
	captureUnexpectedError,
	flushSentry,
	initSentry,
	isSentryActive,
	setupFastifyErrorHandler,
} from "./lib/sentry.js";

const config = loadConfig();
initSentry(config);
const telemetry = initTelemetry(config);

// Now safe to import modules that OTEL instruments
const { buildApp } = await import("./app.js");

const app = buildApp({ config });

async function start() {
	await app.ready();

	// Wire Sentry error handler after all routes are registered
	if (isSentryActive()) {
		setupFastifyErrorHandler(app);
	}

	const address = await app.listen({
		host: app.config.HOST,
		port: app.config.PORT,
	});

	app.log.info({ address }, "API server listening");
}

async function shutdown(signal: string) {
	app.log.info({ signal }, "Received shutdown signal");
	await app.close();
	await flushSentry();
	await shutdownTelemetry(telemetry);
	process.exit(0);
}

function handleShutdownSignal(signal: string) {
	void shutdown(signal).catch(async (error) => {
		app.log.error({ err: error, signal }, "Failed to shut down API server");
		captureUnexpectedError(error, { phase: "shutdown", signal });

		try {
			await flushSentry();
		} finally {
			await shutdownTelemetry(telemetry);
			process.exit(1);
		}
	});
}

process.on("SIGTERM", () => handleShutdownSignal("SIGTERM"));
process.on("SIGINT", () => handleShutdownSignal("SIGINT"));

start().catch(async (error) => {
	app.log.error({ err: error }, "Failed to start API server");
	captureUnexpectedError(error, { phase: "startup" });
	await flushSentry();
	await shutdownTelemetry(telemetry);
	process.exit(1);
});
