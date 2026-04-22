import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockQuit = vi.fn().mockResolvedValue("OK");

vi.mock("ioredis", () => {
	class MockRedis {
		ping = vi.fn().mockResolvedValue("PONG");
		quit = mockQuit;
		options: Record<string, unknown>;

		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});

const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => {
	class MockQueue {
		name: string;
		opts: Record<string, unknown>;
		add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
		close = mockQueueClose;

		constructor(name: string, opts?: Record<string, unknown>) {
			this.name = name;
			this.opts = opts ?? {};
		}
	}
	return { Queue: MockQueue, Worker: vi.fn(), QueueEvents: vi.fn() };
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
			REDIS_URL: "redis://localhost:6379",
		},
	});
}

describe("Queue Plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildPluginTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("decorates fastify with queues", () => {
		expect(app.queues).toBeDefined();
		expect(typeof app.queues).toBe("object");
	});

	it("provides all queue instances", () => {
		expect(app.queues).toHaveProperty("paymentWebhook");
		expect(app.queues).toHaveProperty("email");
		expect(app.queues).toHaveProperty("cleanup");
		expect(app.queues).toHaveProperty("exports");
		expect(app.queues).toHaveProperty("failedJobs");
	});

	it("closes queues on app close", async () => {
		const localApp = buildPluginTestApp();
		await localApp.ready();

		mockQueueClose.mockClear();
		await localApp.close();

		expect(mockQueueClose).toHaveBeenCalledTimes(5);
	});

	it("closes BullMQ connection on app close", async () => {
		const localApp = buildPluginTestApp();
		await localApp.ready();

		mockQuit.mockClear();
		await localApp.close();

		// 5 Redis namespace clients + 1 BullMQ connection = 6
		expect(mockQuit).toHaveBeenCalledTimes(6);
	});
});
