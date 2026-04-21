import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/build-app.js";

describe("GET /ready", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns a readiness payload", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ status: "ok" });
		expect(response.json().uptime).toBeGreaterThanOrEqual(0);
	});
});
