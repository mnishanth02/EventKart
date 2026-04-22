import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { createIpAllowlistMiddleware } from "../../src/middleware/require-ip-allowlist.js";

function buildTestApp(adminIpAllowlist?: string): FastifyInstance {
	const config: Record<string, unknown> = {
		HOST: "127.0.0.1",
		PORT: 3001,
		LOG_LEVEL: "info",
		WEB_ORIGIN: "http://localhost:3000",
		INTERNAL_API_KEY: "test-internal-key",
		DATABASE_URL:
			"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
		REDIS_URL: "redis://localhost:6379",
	};
	if (adminIpAllowlist) {
		config.ADMIN_IP_ALLOWLIST = adminIpAllowlist;
	}

	const app = buildApp({ logger: false, config });

	app.after(() => {
		const middleware = createIpAllowlistMiddleware(app.config);
		app.get(
			"/test/admin-ip",
			{ onRequest: [middleware] },
			async () => ({ ok: true }),
		);
	});

	return app;
}

describe("require-ip-allowlist middleware", () => {
	// ── Allowed IP ─────────────────────────────────────────────

	describe("single IP allowlist", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp("127.0.0.1");
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("allowed IP returns 200", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "127.0.0.1" },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ ok: true });
		});

		it("blocked IP returns 403 with IP_NOT_ALLOWED code", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "192.168.1.1" },
			});
			expect(res.statusCode).toBe(403);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "IP_NOT_ALLOWED",
					message: "Access denied: IP address not allowed",
				},
			});
		});
	});

	// ── CIDR range matching ────────────────────────────────────

	describe("CIDR range matching", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp("10.0.0.0/8");
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("IP within CIDR range is allowed", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "10.1.2.3" },
			});
			expect(res.statusCode).toBe(200);
		});

		it("IP outside CIDR range is blocked", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "192.168.1.1" },
			});
			expect(res.statusCode).toBe(403);
		});
	});

	// ── Empty/unset allowlist allows all ───────────────────────

	describe("unset allowlist (pass-through)", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp(); // No ADMIN_IP_ALLOWLIST
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("any IP passes when allowlist is not configured", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "203.0.113.42" },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ ok: true });
		});
	});

	// ── Multiple IPs in allowlist ──────────────────────────────

	describe("multiple IPs in allowlist", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp("10.0.0.1,192.168.1.1");
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("first listed IP is allowed", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "10.0.0.1" },
			});
			expect(res.statusCode).toBe(200);
		});

		it("second listed IP is allowed", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "192.168.1.1" },
			});
			expect(res.statusCode).toBe(200);
		});

		it("unlisted IP is blocked", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "172.16.0.1" },
			});
			expect(res.statusCode).toBe(403);
		});
	});

	// ── IPv6 loopback ──────────────────────────────────────────

	describe("IPv6 loopback", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp("::1");
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("IPv6 loopback ::1 is allowed", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "::1" },
			});
			expect(res.statusCode).toBe(200);
		});
	});

	// ── Error response structure ───────────────────────────────

	describe("error response structure", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildTestApp("10.0.0.1");
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("403 body matches expected structure", async () => {
			const res = await app.inject({
				method: "GET",
				url: "/test/admin-ip",
				headers: { "x-forwarded-for": "192.168.1.1" },
			});
			expect(res.statusCode).toBe(403);
			expect(res.json()).toEqual({
				success: false,
				error: {
					code: "IP_NOT_ALLOWED",
					message: "Access denied: IP address not allowed",
				},
			});
		});
	});
});
