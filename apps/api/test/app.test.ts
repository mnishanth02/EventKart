import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/lib/config.js";
import { buildTestApp } from "./helpers/build-app.js";

describe("buildApp", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("decorates the Fastify instance with validated config", () => {
		expect(app.config.HOST).toBe("127.0.0.1");
		expect(app.config.PORT).toBe(3001);
		expect(app.config.WEB_ORIGIN).toBe("http://localhost:3000");
		expect(app.config.WEB_ORIGINS).toEqual([
			"http://localhost:3000",
			"http://localhost:3002",
		]);
		expect(app.config.INTERNAL_API_KEY).toBe("test-internal-key");
	});

	it("rejects invalid port values", () => {
		expect(() =>
			loadConfig({
				PORT: "not-a-port",
			}),
		).toThrow();
	});

	it("rejects invalid web origins", () => {
		expect(() =>
			loadConfig({
				HOST: "0.0.0.0",
				PORT: "3000",
				LOG_LEVEL: "info",
				WEB_ORIGIN: "https://eventkart.app/api",
				DATABASE_URL:
					"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			}),
		).toThrow(
			"Invalid configuration: WEB_ORIGIN must contain one or more comma-separated absolute origins without paths, queries, or hashes.",
		);
	});

	it("accepts comma-separated web origins and keeps the first as the primary origin", () => {
		const config = loadConfig({
			HOST: "0.0.0.0",
			PORT: "3000",
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000, http://localhost:3002",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
		});

		expect(config.WEB_ORIGIN).toBe("http://localhost:3000");
		expect(config.WEB_ORIGINS).toEqual([
			"http://localhost:3000",
			"http://localhost:3002",
		]);
	});

	it("preserves normalized web origins when config is loaded again", () => {
		const config = loadConfig({
			HOST: "0.0.0.0",
			PORT: "3000",
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000, http://localhost:3002",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
		});

		const reloadedConfig = loadConfig(config);

		expect(reloadedConfig.WEB_ORIGIN).toBe("http://localhost:3000");
		expect(reloadedConfig.WEB_ORIGINS).toEqual([
			"http://localhost:3000",
			"http://localhost:3002",
		]);
	});

	it("keeps fallback origins when building the app from loaded config", async () => {
		const config = loadConfig({
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000,http://localhost:3002",
			INTERNAL_API_KEY: "test-internal-key",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		});
		const appFromLoadedConfig = buildApp({ logger: false, config });

		try {
			await appFromLoadedConfig.ready();

			const response = await appFromLoadedConfig.inject({
				method: "OPTIONS",
				url: "/api/v1/auth/logout",
				headers: {
					origin: "http://localhost:3002",
					"access-control-request-method": "POST",
					"access-control-request-headers": "x-csrf-token,content-type",
				},
			});

			expect(response.statusCode).toBe(204);
			expect(response.headers["access-control-allow-origin"]).toBe(
				"http://localhost:3002",
			);
		} finally {
			await appFromLoadedConfig.close();
		}
	});

	it("treats a blank internal api key as unset", () => {
		const config = loadConfig({
			HOST: "0.0.0.0",
			PORT: "3000",
			LOG_LEVEL: "info",
			WEB_ORIGIN: "https://eventkart.app",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			INTERNAL_API_KEY: "",
		});

		expect(config.INTERNAL_API_KEY).toBeUndefined();
	});

	it("defaults HOST and local fallback web origins when unset", () => {
		const originalHost = process.env.HOST;
		const originalWebOrigin = process.env.WEB_ORIGIN;
		delete process.env.HOST;
		delete process.env.WEB_ORIGIN;
		try {
			const config = loadConfig({
				DATABASE_URL:
					"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			});

			expect(config.HOST).toBe("::");
			expect(config.WEB_ORIGIN).toBe("http://localhost:3000");
			expect(config.WEB_ORIGINS).toEqual([
				"http://localhost:3000",
				"http://localhost:3002",
			]);
		} finally {
			if (originalHost !== undefined) {
				process.env.HOST = originalHost;
			}
			if (originalWebOrigin !== undefined) {
				process.env.WEB_ORIGIN = originalWebOrigin;
			}
		}
	});

	it("accepts explicit default ports in web origins", () => {
		const config = loadConfig({
			HOST: "0.0.0.0",
			PORT: "3000",
			LOG_LEVEL: "info",
			WEB_ORIGIN: "https://eventkart.app:443",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
		});

		expect(config.WEB_ORIGIN).toBe("https://eventkart.app");
	});
});
