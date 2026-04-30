import { beforeEach, describe, expect, it, vi } from "vitest";

const constructorCalls: Array<[string, Record<string, unknown>]> = [];
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: "mock-id", name: "mock-job" });

vi.mock("bullmq", () => {
	class MockQueue {
		name: string;
		opts: Record<string, unknown>;
		close = mockClose;
		add = mockAdd;

		constructor(name: string, opts?: Record<string, unknown>) {
			constructorCalls.push([name, opts ?? {}]);
			this.name = name;
			this.opts = opts ?? {};
		}
	}
	return { Queue: MockQueue, Worker: vi.fn(), QueueEvents: vi.fn() };
});

import {
	closeQueues,
	createDLQHandler,
	createQueues,
	QUEUE_CONFIGS,
	QUEUE_NAMES,
} from "../../src/lib/queue.js";

describe("Queue Library", () => {
	beforeEach(() => {
		constructorCalls.length = 0;
		vi.clearAllMocks();
	});

	describe("QUEUE_NAMES", () => {
		it("has exactly 8 queue names", () => {
			expect(Object.keys(QUEUE_NAMES)).toHaveLength(8);
		});

		it("has correct string values", () => {
			expect(QUEUE_NAMES.paymentWebhook).toBe("payment-webhook");
			expect(QUEUE_NAMES.email).toBe("email");
			expect(QUEUE_NAMES.cleanup).toBe("cleanup");
			expect(QUEUE_NAMES.exports).toBe("exports");
			expect(QUEUE_NAMES.failedJobs).toBe("failed-jobs");
			expect(QUEUE_NAMES.razorpayAccount).toBe("razorpay-account");
			expect(QUEUE_NAMES.cdnPurge).toBe("cdn-purge");
			expect(QUEUE_NAMES.sitemapRegen).toBe("sitemap-regen");
		});
	});

	describe("QUEUE_CONFIGS", () => {
		it("has config for all 8 queues", () => {
			expect(Object.keys(QUEUE_CONFIGS)).toHaveLength(8);
		});

		it("payment-webhook: concurrency 10, attempts 3, exponential backoff", () => {
			const config = QUEUE_CONFIGS["payment-webhook"];
			expect(config.concurrency).toBe(10);
			expect(config.defaultJobOptions.attempts).toBe(3);
			expect(config.defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 1000,
			});
		});

		it("email: concurrency 5, attempts 2, exponential backoff", () => {
			const config = QUEUE_CONFIGS.email;
			expect(config.concurrency).toBe(5);
			expect(config.defaultJobOptions.attempts).toBe(2);
			expect(config.defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 1000,
			});
		});

		it("cleanup: concurrency 2, attempts 1, no backoff", () => {
			const config = QUEUE_CONFIGS.cleanup;
			expect(config.concurrency).toBe(2);
			expect(config.defaultJobOptions.attempts).toBe(1);
			expect(config.defaultJobOptions.backoff).toBeUndefined();
		});

		it("exports: concurrency 1, attempts 2, exponential backoff", () => {
			const config = QUEUE_CONFIGS.exports;
			expect(config.concurrency).toBe(1);
			expect(config.defaultJobOptions.attempts).toBe(2);
			expect(config.defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 1000,
			});
		});

		it("failed-jobs: concurrency 1, attempts 1, removeOnFail false", () => {
			const config = QUEUE_CONFIGS["failed-jobs"];
			expect(config.concurrency).toBe(1);
			expect(config.defaultJobOptions.attempts).toBe(1);
			expect(config.defaultJobOptions.removeOnFail).toBe(false);
		});

		it("cdn-purge: concurrency 5, attempts 3, exponential 5s backoff (I-2.4.2)", () => {
			const config = QUEUE_CONFIGS["cdn-purge"];
			expect(config.concurrency).toBe(5);
			expect(config.defaultJobOptions.attempts).toBe(3);
			expect(config.defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 5000,
			});
		});

		it("sitemap-regen: concurrency 1, attempts 2, exponential 5s backoff, removeOnComplete: true", () => {
			const config = QUEUE_CONFIGS["sitemap-regen"];
			expect(config.concurrency).toBe(1);
			expect(config.defaultJobOptions.attempts).toBe(2);
			expect(config.defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 5000,
			});
			// Critical: completed jobs MUST be removed immediately
			// (not retained as `{ count: N }`) so the fixed debounce
			// jobId can be re-used by the next ad-hoc enqueue.
			expect(config.defaultJobOptions.removeOnComplete).toBe(true);
		});
	});

	describe("createQueues", () => {
		const fakeConnection = {} as never;

		it("returns all 8 queue properties", () => {
			const queues = createQueues(fakeConnection);

			expect(queues).toHaveProperty("paymentWebhook");
			expect(queues).toHaveProperty("email");
			expect(queues).toHaveProperty("cleanup");
			expect(queues).toHaveProperty("exports");
			expect(queues).toHaveProperty("failedJobs");
			expect(queues).toHaveProperty("razorpayAccount");
			expect(queues).toHaveProperty("cdnPurge");
			expect(queues).toHaveProperty("sitemapRegen");
		});

		it("creates 8 Queue instances", () => {
			createQueues(fakeConnection);
			expect(constructorCalls).toHaveLength(8);
		});

		it("passes correct queue names to Queue constructor", () => {
			createQueues(fakeConnection);

			const names = constructorCalls.map(([name]) => name);
			expect(names).toContain("payment-webhook");
			expect(names).toContain("email");
			expect(names).toContain("cleanup");
			expect(names).toContain("exports");
			expect(names).toContain("failed-jobs");
			expect(names).toContain("razorpay-account");
			expect(names).toContain("cdn-purge");
			expect(names).toContain("sitemap-regen");
		});

		it("passes connection to all queues", () => {
			createQueues(fakeConnection);

			for (const [, opts] of constructorCalls) {
				expect(opts.connection).toBe(fakeConnection);
			}
		});

		it("passes defaultJobOptions from QUEUE_CONFIGS", () => {
			createQueues(fakeConnection);

			for (const [name, opts] of constructorCalls) {
				const config = QUEUE_CONFIGS[name as keyof typeof QUEUE_CONFIGS];
				expect(opts.defaultJobOptions).toEqual(config.defaultJobOptions);
			}
		});
	});

	describe("closeQueues", () => {
		it("calls close() on all 8 queues", async () => {
			const queues = createQueues({} as never);
			mockClose.mockClear();

			await closeQueues(queues);
			expect(mockClose).toHaveBeenCalledTimes(8);
		});

		it("tolerates close() rejections (uses allSettled)", async () => {
			const queues = createQueues({} as never);
			mockClose.mockClear();
			mockClose
				.mockRejectedValueOnce(new Error("connection lost"))
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error("timeout"))
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined);

			await expect(closeQueues(queues)).resolves.toBeUndefined();
			expect(mockClose).toHaveBeenCalledTimes(8);
		});
	});

	describe("createDLQHandler", () => {
		it("returns a function", () => {
			const queues = createQueues({} as never);
			const handler = createDLQHandler(queues.failedJobs);
			expect(typeof handler).toBe("function");
		});

		it("skips undefined jobs", async () => {
			const queues = createQueues({} as never);
			const handler = createDLQHandler(queues.failedJobs);
			mockAdd.mockClear();

			await handler(undefined, new Error("test error"));
			expect(mockAdd).not.toHaveBeenCalled();
		});

		it("skips jobs with remaining retries", async () => {
			const queues = createQueues({} as never);
			const handler = createDLQHandler(queues.failedJobs);
			mockAdd.mockClear();

			const job = {
				id: "job-1",
				name: "process-payment",
				queueName: "payment-webhook",
				data: { paymentId: "pay_123" },
				attemptsMade: 1,
				opts: { attempts: 3 },
			};

			await handler(job, new Error("temporary failure"));
			expect(mockAdd).not.toHaveBeenCalled();
		});

		it("adds exhausted job to failedJobs queue with correct data shape", async () => {
			const queues = createQueues({} as never);
			const handler = createDLQHandler(queues.failedJobs);
			mockAdd.mockClear();

			const job = {
				id: "job-42",
				name: "send-email",
				queueName: "email",
				data: { to: "user@example.com" },
				attemptsMade: 2,
				opts: { attempts: 2 },
			};
			const error = new Error("SMTP timeout");

			await handler(job, error);

			expect(mockAdd).toHaveBeenCalledTimes(1);
			const [jobName, jobData] = mockAdd.mock.calls[0] as [
				string,
				Record<string, unknown>,
				Record<string, unknown>,
			];

			expect(jobName).toBe("failed");
			expect(jobData).toMatchObject({
				queue: "email",
				jobId: "job-42",
				jobName: "send-email",
				data: { to: "user@example.com" },
				error: "SMTP timeout",
				attemptsMade: 2,
			});
			expect(jobData).toHaveProperty("stackTrace");
			expect(jobData).toHaveProperty("failedAt");
		});

		it("uses composite jobId format: {queueName}:{jobId}:{timestamp}", async () => {
			const queues = createQueues({} as never);
			const handler = createDLQHandler(queues.failedJobs);
			mockAdd.mockClear();

			const now = Date.now();
			const job = {
				id: "job-99",
				name: "cleanup-task",
				queueName: "cleanup",
				data: {},
				attemptsMade: 1,
				opts: { attempts: 1 },
			};

			await handler(job, new Error("fail"));

			const [, , jobOpts] = mockAdd.mock.calls[0] as [
				string,
				Record<string, unknown>,
				Record<string, unknown>,
			];
			const jobId = jobOpts.jobId as string;
			expect(jobId).toMatch(/^cleanup:job-99:\d+$/);

			const timestamp = Number(jobId.split(":").pop());
			expect(timestamp).toBeGreaterThanOrEqual(now);
			expect(timestamp).toBeLessThanOrEqual(Date.now());
		});
	});
});
