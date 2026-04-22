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

// Global mock for bullmq — prevents real queue connections in all tests.
vi.mock("bullmq", () => {
	class MockQueue {
		name: string;
		opts: Record<string, unknown>;
		add = vi.fn().mockResolvedValue({ id: "mock-job-id", name: "mock-job" });
		close = vi.fn().mockResolvedValue(undefined);
		getJobCounts = vi
			.fn()
			.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 });

		constructor(name: string, opts?: Record<string, unknown>) {
			this.name = name;
			this.opts = opts ?? {};
		}
	}

	class MockWorker {
		name: string;
		opts: Record<string, unknown>;
		close = vi.fn().mockResolvedValue(undefined);
		on = vi.fn().mockReturnThis();

		constructor(
			name: string,
			_processor: unknown,
			opts?: Record<string, unknown>,
		) {
			this.name = name;
			this.opts = opts ?? {};
		}
	}

	class MockQueueEvents {
		close = vi.fn().mockResolvedValue(undefined);
		on = vi.fn().mockReturnThis();
		name: string;
		opts: Record<string, unknown>;

		constructor(name: string, opts?: Record<string, unknown>) {
			this.name = name;
			this.opts = opts ?? {};
		}
	}

	return {
		Queue: MockQueue,
		Worker: MockWorker,
		QueueEvents: MockQueueEvents,
	};
});
