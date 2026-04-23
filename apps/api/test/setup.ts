import { vi } from "vitest";

// Global mock for ioredis — prevents real Redis connections in all tests.
// Individual test files can override with their own vi.mock("ioredis", ...).
vi.mock("ioredis", () => {
	class MockRedis {
		ping = vi.fn().mockResolvedValue("PONG");
		quit = vi.fn().mockResolvedValue("OK");
		get = vi.fn().mockResolvedValue(null);
		set = vi.fn().mockResolvedValue("OK");
		del = vi.fn().mockResolvedValue(1);
		ttl = vi.fn().mockResolvedValue(-2);
		eval = vi.fn().mockResolvedValue(null);
		pipeline = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnThis(),
			exec: vi.fn().mockResolvedValue([]),
		});
		defineCommand: ReturnType<typeof vi.fn>;
		options: Record<string, unknown>;

		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
			const self = this as Record<string, unknown>;
			this.defineCommand = vi.fn().mockImplementation((name: string) => {
				self[name] = vi.fn().mockImplementation((...args: unknown[]) => {
					const lastArg = args[args.length - 1];
					if (typeof lastArg === "function") {
						(lastArg as (err: null, result: number[]) => void)(null, [0, 0]);
						return;
					}
					return Promise.resolve([0, 0]);
				});
			});
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});

// Global mock for @repo/db — prevents real PostgreSQL connections in all tests.
vi.mock("@repo/db", () => {
	const mockDb = {
		execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
	};
	return {
		createDatabase: vi.fn().mockReturnValue(mockDb),
		createMigrationClient: vi.fn().mockReturnValue({}),
		pingDatabase: vi.fn().mockResolvedValue(undefined),
	};
});

// Global mock for @sentry/node — prevents real Sentry connections in all tests.
vi.mock("@sentry/node", () => ({
	init: vi.fn(),
	captureException: vi.fn(),
	close: vi.fn().mockResolvedValue(true),
	fastifyIntegration: vi.fn().mockReturnValue({ name: "Fastify" }),
	setupFastifyErrorHandler: vi.fn(),
	setTag: vi.fn(),
	setExtra: vi.fn(),
	setUser: vi.fn(),
	withScope: vi.fn((callback: (scope: unknown) => void) => {
		callback({
			setTag: vi.fn(),
			setExtra: vi.fn(),
			setExtras: vi.fn(),
			setUser: vi.fn(),
		});
	}),
}));

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
