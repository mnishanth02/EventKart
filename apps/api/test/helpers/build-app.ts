import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

export async function buildTestApp(): Promise<FastifyInstance> {
	const app = buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			INTERNAL_API_KEY: "test-internal-key",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		},
	});

	await app.ready();

	return app;
}
