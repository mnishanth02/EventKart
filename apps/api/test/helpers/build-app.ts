import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/lib/config.js";

export async function buildTestApp(
	overrides: Partial<AppConfig> = {},
): Promise<FastifyInstance> {
	const app = buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000,http://localhost:3002",
			INTERNAL_API_KEY: "test-internal-key",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
			// Default ON for legacy tests that assert capacity projection. Tests
			// covering the flag-off behaviour pass `PUBLIC_SPOTS_REMAINING_BADGE_ENABLED: false`.
			PUBLIC_SPOTS_REMAINING_BADGE_ENABLED: true,
			...overrides,
		},
	});

	await app.ready();

	return app;
}
