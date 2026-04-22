import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/build-app.js";

describe("Security Headers Plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("includes Content-Security-Policy header", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["content-security-policy"]).toBeDefined();
		expect(response.headers["content-security-policy"]).toContain(
			"default-src 'none'",
		);
	});

	it("includes X-Frame-Options: DENY", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["x-frame-options"]).toBe("DENY");
	});

	it("includes X-Content-Type-Options: nosniff", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["x-content-type-options"]).toBe("nosniff");
	});

	it("includes Strict-Transport-Security", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["strict-transport-security"]).toBeDefined();
		expect(response.headers["strict-transport-security"]).toContain(
			"max-age=",
		);
	});

	it("includes X-DNS-Prefetch-Control", async () => {
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["x-dns-prefetch-control"]).toBeDefined();
	});

	it("security headers coexist with CORS headers", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
			headers: {
				origin: "http://localhost:3000",
			},
		});

		expect(response.headers["access-control-allow-origin"]).toBeDefined();
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
	});
});
