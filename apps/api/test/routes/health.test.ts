import type { FastifyInstance } from "fastify";
import type { Mock } from "vitest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pingDatabase } from "@repo/db";

import { buildTestApp } from "../helpers/build-app.js";

const mockPingDatabase = vi.mocked(pingDatabase);

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

describe("GET /ready", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns 200 with checks when all dependencies are healthy", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.status).toBe("ok");
		expect(body.uptime).toBeGreaterThan(0);
		expect(body.checks).toHaveLength(2);

		const pgCheck = body.checks.find(
			(c: { name: string }) => c.name === "postgres",
		);
		const redisCheck = body.checks.find(
			(c: { name: string }) => c.name === "redis",
		);

		expect(pgCheck).toEqual({
			name: "postgres",
			status: "ok",
			latency_ms: expect.any(Number),
		});
		expect(redisCheck).toEqual({
			name: "redis",
			status: "ok",
			latency_ms: expect.any(Number),
		});
	});

	it("returns checks with correct structure (name, status, latency_ms)", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		const body = response.json();
		for (const check of body.checks) {
			expect(check).toHaveProperty("name");
			expect(check).toHaveProperty("status");
			expect(check).toHaveProperty("latency_ms");
			expect(typeof check.name).toBe("string");
			expect(["ok", "error"]).toContain(check.status);
			expect(typeof check.latency_ms).toBe("number");
			expect(check.latency_ms).toBeGreaterThanOrEqual(0);
		}
	});

	it("returns 503 when Redis ping fails", async () => {
		const mockPing = app.redis.base.ping as Mock;
		mockPing.mockRejectedValueOnce(new Error("ECONNREFUSED"));

		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		expect(response.statusCode).toBe(503);
		const body = response.json();
		expect(body.status).toBe("degraded");
		expect(body.uptime).toBeGreaterThan(0);

		const redisCheck = body.checks.find(
			(c: { name: string }) => c.name === "redis",
		);
		expect(redisCheck.status).toBe("error");
		expect(redisCheck.message).toBe("Connection failed");

		// Postgres should still be ok
		const pgCheck = body.checks.find(
			(c: { name: string }) => c.name === "postgres",
		);
		expect(pgCheck.status).toBe("ok");
	});

	it("returns 503 when DB execute fails", async () => {
		mockPingDatabase.mockRejectedValueOnce(
			new Error("connection refused to 5432"),
		);

		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		expect(response.statusCode).toBe(503);
		const body = response.json();
		expect(body.status).toBe("degraded");

		const pgCheck = body.checks.find(
			(c: { name: string }) => c.name === "postgres",
		);
		expect(pgCheck.status).toBe("error");
		expect(pgCheck.message).toBe("Connection failed");

		// Redis should still be ok
		const redisCheck = body.checks.find(
			(c: { name: string }) => c.name === "redis",
		);
		expect(redisCheck.status).toBe("ok");
	});

	it("returns sanitized error messages — no raw error strings", async () => {
		mockPingDatabase.mockRejectedValueOnce(
			new Error("FATAL: password authentication failed for user 'eventkart'"),
		);
		(app.redis.base.ping as Mock).mockRejectedValueOnce(
			new Error("WRONGPASS invalid username-password pair"),
		);

		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		expect(response.statusCode).toBe(503);
		const body = response.json();

		for (const check of body.checks) {
			if (check.message) {
				expect(check.message).toMatch(/^(Connection failed|Timeout)$/);
				expect(check.message).not.toContain("FATAL");
				expect(check.message).not.toContain("WRONGPASS");
				expect(check.message).not.toContain("password");
			}
		}
	});

	it("returns uptime as a positive number", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/ready",
		});

		const body = response.json();
		expect(typeof body.uptime).toBe("number");
		expect(body.uptime).toBeGreaterThan(0);
	});
});
