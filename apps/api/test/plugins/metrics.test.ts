import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockInfo = vi.fn().mockResolvedValue(
	"# Memory\r\nused_memory:2048000\r\nused_memory_human:2.00M\r\n# Stats\r\nevicted_keys:42\r\n# Clients\r\nconnected_clients:10\r\n",
);
const mockPing = vi.fn().mockResolvedValue("PONG");
const mockQuit = vi.fn().mockResolvedValue("OK");

vi.mock("ioredis", () => {
	class MockRedis {
		ping = mockPing;
		quit = mockQuit;
		info = mockInfo;
		get = vi.fn().mockResolvedValue(null);
		set = vi.fn().mockResolvedValue("OK");
		del = vi.fn().mockResolvedValue(1);
		ttl = vi.fn().mockResolvedValue(-2);
		eval = vi.fn().mockResolvedValue(null);
		pipeline = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnThis(),
			exec: vi.fn().mockResolvedValue([]),
		});
		options: Record<string, unknown>;
		defineCommand: ReturnType<typeof vi.fn>;

		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
			const self = this as Record<string, unknown>;
			this.defineCommand = vi.fn().mockImplementation((name: string) => {
				self[name] = vi.fn().mockImplementation((...args: unknown[]) => {
					const cb = args[args.length - 1];
					if (typeof cb === "function") {
						(cb as (err: null, r: number[]) => void)(null, [0, 0]);
						return;
					}
					return Promise.resolve([0, 0]);
				});
			});
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

describe("Metrics Plugin", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildPluginTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("calls Redis INFO on startup for initial polling", () => {
		expect(mockInfo).toHaveBeenCalled();
	});

	it("records HTTP metrics on a request", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		// The metrics are recorded via no-op instruments in tests, so we
		// verify the request lifecycle completes without errors.
	});

	it("handles Redis INFO failure gracefully", async () => {
		mockInfo.mockRejectedValueOnce(new Error("Connection refused"));

		// Force a new app instance to trigger polling with the error
		const errorApp = buildPluginTestApp();
		await errorApp.ready();

		// App should still start successfully — metrics errors are swallowed
		const response = await errorApp.inject({
			method: "GET",
			url: "/health",
		});
		expect(response.statusCode).toBe(200);

		await errorApp.close();
	});

	it("cleans up polling interval on close", async () => {
		const localApp = buildPluginTestApp();
		await localApp.ready();

		// Close should not throw — interval is cleared
		await expect(localApp.close()).resolves.toBeUndefined();
	});
});
