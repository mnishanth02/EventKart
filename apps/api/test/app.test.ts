import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
			"Invalid configuration: WEB_ORIGIN must be an absolute origin without a path, query, or hash.",
		);
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
