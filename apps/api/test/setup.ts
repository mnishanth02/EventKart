import { vi } from "vitest";

// Global mock for ioredis — prevents real Redis connections in all tests.
// Individual test files can override with their own vi.mock("ioredis", ...).
vi.mock("ioredis", () => {
	class MockRedis {
		ping = vi.fn().mockResolvedValue("PONG");
		quit = vi.fn().mockResolvedValue("OK");
		options: Record<string, unknown>;

		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});
