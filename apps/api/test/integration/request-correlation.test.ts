import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";

describe("request correlation", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("generates X-Request-ID when none is provided", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		const requestId = response.headers["x-request-id"];
		expect(requestId).toBeDefined();
		expect(typeof requestId).toBe("string");
		expect((requestId as string).length).toBeGreaterThan(0);
	});

	it("preserves client-provided X-Request-ID", async () => {
		const customId = "custom-correlation-id-12345";
		const response = await app.inject({
			method: "GET",
			url: "/health",
			headers: {
				"x-request-id": customId,
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["x-request-id"]).toBe(customId);
	});

	it("returns different request IDs for different requests", async () => {
		const response1 = await app.inject({ method: "GET", url: "/health" });
		const response2 = await app.inject({ method: "GET", url: "/health" });

		const id1 = response1.headers["x-request-id"];
		const id2 = response2.headers["x-request-id"];

		expect(id1).toBeDefined();
		expect(id2).toBeDefined();
		expect(id1).not.toBe(id2);
	});
});
