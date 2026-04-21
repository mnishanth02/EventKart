import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/build-app.js";

describe("GET /health", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns a liveness payload", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("application/json");
		expect(response.headers["x-request-id"]).toBeTruthy();
		expect(response.json()).toEqual({ status: "ok" });
	});

	it("returns CORS headers for the configured browser origin", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
			headers: {
				origin: "http://localhost:3000",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"http://localhost:3000",
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
	});

	it("handles CORS preflight requests", async () => {
		const response = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				origin: "http://localhost:3000",
				"access-control-request-method": "GET",
			},
		});

		expect(response.statusCode).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"http://localhost:3000",
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
		expect(response.headers["access-control-allow-methods"]).toContain("GET");
	});
});
