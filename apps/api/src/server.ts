import { buildApp } from "./app.js";

const app = buildApp();

async function start() {
	await app.ready();

	const address = await app.listen({
		host: app.config.HOST,
		port: app.config.PORT,
	});

	app.log.info({ address }, "API server listening");
}

start().catch((error) => {
	app.log.error({ err: error }, "Failed to start API server");
	process.exit(1);
});
