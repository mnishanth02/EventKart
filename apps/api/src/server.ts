// Sentry must init first — it takes over OpenTelemetry when active
import { initSentry, flushSentry } from "./lib/sentry.js";
import { initTelemetry, shutdownTelemetry } from "./lib/otel.js";
import { loadConfig } from "./lib/config.js";

const config = loadConfig();
initSentry(config);
const telemetry = initTelemetry(config);

// Now safe to import modules that OTEL instruments
const { buildApp } = await import("./app.js");

const app = buildApp();

async function start() {
	await app.ready();

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

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch(async (error) => {
	app.log.error({ err: error }, "Failed to start API server");
	await flushSentry();
	await shutdownTelemetry(telemetry);
	process.exit(1);
});
