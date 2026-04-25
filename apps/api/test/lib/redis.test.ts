import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuit = vi.fn().mockResolvedValue("OK");
const mockPing = vi.fn().mockResolvedValue("PONG");
const constructorCalls: Array<[string, Record<string, unknown>]> = [];

vi.mock("ioredis", () => {
	class MockRedis {
		quit = mockQuit;
		ping = mockPing;
		options: Record<string, unknown>;

		constructor(url: string, options?: Record<string, unknown>) {
			constructorCalls.push([url, options ?? {}]);
			this.options = options ?? {};
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});

import {
	closeRedisClients,
	createBullMQConnection,
	createRedisClient,
	createRedisClients,
	REDIS_NAMESPACES,
} from "../../src/lib/redis.js";

function findCallByPrefix(
	prefix: string | undefined,
): [string, Record<string, unknown>] | undefined {
	return constructorCalls.find(([, opts]) =>
		prefix ? opts.keyPrefix === prefix : !opts.keyPrefix,
	);
}

describe("Redis Library", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		constructorCalls.length = 0;
	});

	describe("REDIS_NAMESPACES", () => {
		it("has exactly 5 namespaces with correct prefixes", () => {
			expect(Object.keys(REDIS_NAMESPACES)).toHaveLength(5);
			expect(REDIS_NAMESPACES.session).toBe("sess:");
			expect(REDIS_NAMESPACES.bull).toBe("bull:");
			expect(REDIS_NAMESPACES.rateLimit).toBe("rl:");
			expect(REDIS_NAMESPACES.cache).toBe("cache:");
			expect(REDIS_NAMESPACES.otp).toBe("otp:");
		});
	});

	describe("createRedisClient", () => {
		it("creates a Redis client with the given URL", () => {
			const url = "redis://localhost:6379";
			createRedisClient(url);

			expect(constructorCalls).toHaveLength(1);
			expect(constructorCalls[0]?.[0]).toBe(url);
		});

		it("applies keyPrefix when provided", () => {
			createRedisClient("redis://localhost:6379", { keyPrefix: "test:" });
			expect(constructorCalls[0]?.[1].keyPrefix).toBe("test:");
		});

		it("does not set keyPrefix when not provided", () => {
			createRedisClient("redis://localhost:6379");
			expect(constructorCalls[0]?.[1].keyPrefix).toBeUndefined();
		});

		it("defaults lazyConnect to false", () => {
			createRedisClient("redis://localhost:6379");
			expect(constructorCalls[0]?.[1].lazyConnect).toBe(false);
		});

		it("respects lazyConnect: true", () => {
			createRedisClient("redis://localhost:6379", { lazyConnect: true });
			expect(constructorCalls[0]?.[1].lazyConnect).toBe(true);
		});

		it("sets maxRetriesPerRequest to null (BullMQ compatible)", () => {
			createRedisClient("redis://localhost:6379");
			expect(constructorCalls[0]?.[1].maxRetriesPerRequest).toBeNull();
		});

		it("enables offline queue", () => {
			createRedisClient("redis://localhost:6379");
			expect(constructorCalls[0]?.[1].enableOfflineQueue).toBe(true);
		});

		it("retryStrategy returns exponential backoff capped at 2000ms", () => {
			createRedisClient("redis://localhost:6379");
			const retryStrategy = constructorCalls[0]?.[1].retryStrategy as (
				t: number,
			) => number;

			expect(retryStrategy(1)).toBe(50);
			expect(retryStrategy(10)).toBe(500);
			expect(retryStrategy(40)).toBe(2000);
			expect(retryStrategy(100)).toBe(2000);
		});
	});

	describe("createRedisClients", () => {
		it("returns all 5 namespace clients", () => {
			const clients = createRedisClients("redis://localhost:6379");

			expect(clients).toHaveProperty("base");
			expect(clients).toHaveProperty("session");
			expect(clients).toHaveProperty("rateLimit");
			expect(clients).toHaveProperty("cache");
			expect(clients).toHaveProperty("otp");
			expect(Object.keys(clients)).toHaveLength(5);
		});

		it("creates 5 Redis instances", () => {
			createRedisClients("redis://localhost:6379");
			expect(constructorCalls).toHaveLength(5);
		});

		it("passes the URL to all clients", () => {
			const url = "redis://custom:6380";
			createRedisClients(url);

			for (const call of constructorCalls) {
				expect(call[0]).toBe(url);
			}
		});

		it("creates base client without keyPrefix", () => {
			createRedisClients("redis://localhost:6379");
			expect(findCallByPrefix(undefined)).toBeDefined();
		});

		it("creates session client with sess: prefix", () => {
			createRedisClients("redis://localhost:6379");
			expect(findCallByPrefix("sess:")).toBeDefined();
		});

		it("creates rateLimit client with rl: prefix", () => {
			createRedisClients("redis://localhost:6379");
			expect(findCallByPrefix("rl:")).toBeDefined();
		});

		it("creates cache client with cache: prefix", () => {
			createRedisClients("redis://localhost:6379");
			expect(findCallByPrefix("cache:")).toBeDefined();
		});

		it("creates otp client with otp: prefix", () => {
			createRedisClients("redis://localhost:6379");
			expect(findCallByPrefix("otp:")).toBeDefined();
		});
	});

	describe("createBullMQConnection", () => {
		it("creates a Redis instance without keyPrefix", () => {
			createBullMQConnection("redis://localhost:6379");

			expect(constructorCalls).toHaveLength(1);
			expect(constructorCalls[0]?.[1].keyPrefix).toBeUndefined();
		});

		it("sets maxRetriesPerRequest to null", () => {
			createBullMQConnection("redis://localhost:6379");
			expect(constructorCalls[0]?.[1].maxRetriesPerRequest).toBeNull();
		});
	});

	describe("closeRedisClients", () => {
		it("calls quit() on all 5 clients", async () => {
			mockQuit.mockResolvedValue("OK");
			const clients = createRedisClients("redis://localhost:6379");
			mockQuit.mockClear();

			await closeRedisClients(clients);
			expect(mockQuit).toHaveBeenCalledTimes(5);
		});

		it("tolerates quit() rejections (uses allSettled)", async () => {
			const clients = createRedisClients("redis://localhost:6379");
			mockQuit.mockClear();
			mockQuit
				.mockRejectedValueOnce(new Error("connection lost"))
				.mockResolvedValueOnce("OK")
				.mockRejectedValueOnce(new Error("timeout"))
				.mockResolvedValueOnce("OK")
				.mockResolvedValueOnce("OK");

			await expect(closeRedisClients(clients)).resolves.toBeUndefined();
			expect(mockQuit).toHaveBeenCalledTimes(5);
		});

		it("handles all quit() rejections without throwing", async () => {
			const clients = createRedisClients("redis://localhost:6379");
			mockQuit.mockClear();
			mockQuit.mockRejectedValue(new Error("error"));

			await expect(closeRedisClients(clients)).resolves.toBeUndefined();
		});
	});
});
