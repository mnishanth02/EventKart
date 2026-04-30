import { Queue } from "bullmq";
import type { Redis } from "ioredis";

// Queue name constants
export const QUEUE_NAMES = {
	paymentWebhook: "payment-webhook",
	email: "email",
	cleanup: "cleanup",
	exports: "exports",
	failedJobs: "failed-jobs",
	razorpayAccount: "razorpay-account",
	// I-2.4.4: nightly + on-publish sitemap.xml regeneration.
	sitemapRegen: "sitemap-regen",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Per-queue config for workers (concurrency + retry)
export const QUEUE_CONFIGS: Record<
	QueueName,
	{ concurrency: number; defaultJobOptions: Record<string, unknown> }
> = {
	[QUEUE_NAMES.paymentWebhook]: {
		concurrency: 10,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential" as const, delay: 1000 },
			removeOnComplete: { count: 1000 },
			removeOnFail: { count: 5000 },
		},
	},
	[QUEUE_NAMES.email]: {
		concurrency: 5,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential" as const, delay: 1000 },
			removeOnComplete: { count: 1000 },
			removeOnFail: { count: 5000 },
		},
	},
	[QUEUE_NAMES.cleanup]: {
		concurrency: 2,
		defaultJobOptions: {
			attempts: 1,
			removeOnComplete: { count: 100 },
			removeOnFail: { count: 5000 },
		},
	},
	[QUEUE_NAMES.exports]: {
		concurrency: 1,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential" as const, delay: 1000 },
			removeOnComplete: { count: 100 },
			removeOnFail: { count: 5000 },
		},
	},
	[QUEUE_NAMES.failedJobs]: {
		concurrency: 1,
		defaultJobOptions: {
			attempts: 1,
			removeOnComplete: { count: 10000 },
			removeOnFail: false,
		},
	},
	[QUEUE_NAMES.razorpayAccount]: {
		concurrency: 2,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential" as const, delay: 5000 },
			removeOnComplete: { count: 500 },
			removeOnFail: { count: 5000 },
		},
	},
	[QUEUE_NAMES.sitemapRegen]: {
		// I-2.4.4: Concurrency 1 — only one regen at a time. Multiple
		// regens in flight would race on the SETEX of
		// `cache:sitemap:current` and waste DB cycles producing identical
		// XML.
		concurrency: 1,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential" as const, delay: 5000 },
			// Remove completed jobs IMMEDIATELY (not after N kept). The
			// ad-hoc enqueue path uses a fixed `jobId` for debounce; if
			// completed jobs are retained, BullMQ's "duplicate jobId
			// rejects new add()" semantics would silently suppress all
			// future ad-hoc enqueues until the retained job is GC'd.
			// Failed jobs DO stay (count: 200) so DLQ + ops have history.
			removeOnComplete: true,
			removeOnFail: { count: 200 },
		},
	},
};

// Typed queue container
export interface AppQueues {
	paymentWebhook: Queue;
	email: Queue;
	cleanup: Queue;
	exports: Queue;
	failedJobs: Queue;
	razorpayAccount: Queue;
	sitemapRegen: Queue;
}

// Factory: creates all queue instances
export function createQueues(connection: Redis): AppQueues {
	const opts = (name: QueueName) => ({
		connection,
		defaultJobOptions: QUEUE_CONFIGS[name].defaultJobOptions,
	});

	return {
		paymentWebhook: new Queue(
			QUEUE_NAMES.paymentWebhook,
			opts(QUEUE_NAMES.paymentWebhook),
		),
		email: new Queue(QUEUE_NAMES.email, opts(QUEUE_NAMES.email)),
		cleanup: new Queue(QUEUE_NAMES.cleanup, opts(QUEUE_NAMES.cleanup)),
		exports: new Queue(QUEUE_NAMES.exports, opts(QUEUE_NAMES.exports)),
		failedJobs: new Queue(QUEUE_NAMES.failedJobs, opts(QUEUE_NAMES.failedJobs)),
		razorpayAccount: new Queue(
			QUEUE_NAMES.razorpayAccount,
			opts(QUEUE_NAMES.razorpayAccount),
		),
		sitemapRegen: new Queue(
			QUEUE_NAMES.sitemapRegen,
			opts(QUEUE_NAMES.sitemapRegen),
		),
	};
}

// Graceful shutdown
export async function closeQueues(queues: AppQueues): Promise<void> {
	await Promise.allSettled([
		queues.paymentWebhook.close(),
		queues.email.close(),
		queues.cleanup.close(),
		queues.exports.close(),
		queues.failedJobs.close(),
		queues.razorpayAccount.close(),
		queues.sitemapRegen.close(),
	]);
}

// DLQ handler interface — for use in worker service
export interface FailedJobData {
	queue: string;
	jobId: string | undefined;
	jobName: string;
	data: unknown;
	error: string;
	stackTrace: string | undefined;
	attemptsMade: number;
	failedAt: string;
}

// Helper to create a DLQ handler for workers
export function createDLQHandler(failedJobsQueue: Queue) {
	return async function handleFailedJob(
		job:
			| {
					id?: string;
					name: string;
					queueName: string;
					data: unknown;
					attemptsMade: number;
					opts: { attempts?: number };
			  }
			| undefined,
		error: Error,
	): Promise<void> {
		if (!job) return;
		// Only move to DLQ after all retries exhausted
		const maxAttempts = job.opts.attempts ?? 1;
		if (job.attemptsMade < maxAttempts) return;

		const failedJobData: FailedJobData = {
			queue: job.queueName,
			jobId: job.id,
			jobName: job.name,
			data: job.data,
			error: error.message,
			stackTrace: error.stack,
			attemptsMade: job.attemptsMade,
			failedAt: new Date().toISOString(),
		};

		await failedJobsQueue.add("failed", failedJobData, {
			jobId: `${job.queueName}:${job.id ?? "unknown"}:${Date.now()}`,
		});
	};
}
