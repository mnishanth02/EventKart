import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockPing = vi.fn().mockResolvedValue("PONG");
const mockQuit = vi.fn().mockResolvedValue("OK");

vi.mock("ioredis", () => {
	class MockRedis {
		ping = mockPing;
		quit = mockQuit;
		options: Record<string, unknown>;

		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

function buildPluginTestApp(): ReturnType<typeof buildApp> {
	return buildApp({
		logger: false,
		config: {
			HOST: "127.0.0.1",
			PORT: 3001,
			LOG_LEVEL: "info",
			WEB_ORIGIN: "http://localhost:3000",
			DATABASE_URL:
				"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
			REDIS_URL: "redis://localhost:6379",
		},
	});
}

describe("Redis Plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildPluginTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("decorates fastify with redis clients", () => {
		expect(app.redis).toBeDefined();
		expect(typeof app.redis).toBe("object");
	});

	it("provides all namespace clients", () => {
		expect(app.redis).toHaveProperty("base");
		expect(app.redis).toHaveProperty("session");
		expect(app.redis).toHaveProperty("rateLimit");
		expect(app.redis).toHaveProperty("cache");
		expect(app.redis).toHaveProperty("otp");
	});

	it("pings Redis on startup", () => {
		expect(mockPing).toHaveBeenCalled();
	});

	it("calls quit on close", async () => {
		const localApp = buildPluginTestApp();
		await localApp.ready();

		mockQuit.mockClear();
		await localApp.close();

		// 5 Redis namespace clients + 1 BullMQ connection = 6
		expect(mockQuit).toHaveBeenCalledTimes(6);
	});
});
