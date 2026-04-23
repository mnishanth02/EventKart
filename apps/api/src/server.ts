// OTEL SDK must be initialized before any instrumented module (http, fastify, pino)
import { initTelemetry, shutdownTelemetry } from "./lib/otel.js";
import { loadConfig } from "./lib/config.js";

const config = loadConfig();
const sdk = initTelemetry(config);

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
	await shutdownTelemetry(sdk);
	process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch(async (error) => {
	app.log.error({ err: error }, "Failed to start API server");
	await shutdownTelemetry(sdk);
	process.exit(1);
});
