import { Redis } from "ioredis";
import { Queue } from "bullmq";
import { QUEUE_NAMES, createDLQHandler } from "../lib/queue.js";
import { createPaymentWebhookWorker } from "./payment-webhook.js";
import { createEmailWorker } from "./email.js";
import { createCleanupWorker } from "./cleanup.js";
import { createExportsWorker } from "./exports.js";

// Worker service entry point — runs as a separate Railway service.
// Usage: tsx apps/api/src/workers/index.ts

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export async function startWorkers(redisUrl: string = REDIS_URL) {
	const connection = new Redis(redisUrl, {
		maxRetriesPerRequest: null,
		enableOfflineQueue: true,
	});

	// DLQ queue for failed job tracking
	const failedJobsQueue = new Queue(QUEUE_NAMES.failedJobs, { connection });
	const dlqHandler = createDLQHandler(failedJobsQueue);

	const workers = [
		createPaymentWebhookWorker(connection, dlqHandler),
		createEmailWorker(connection, dlqHandler),
		createCleanupWorker(connection, dlqHandler),
		createExportsWorker(connection, dlqHandler),
	];

	// Graceful shutdown
	const shutdown = async (signal: string) => {
		console.log(`Received ${signal}, shutting down workers...`);
		await Promise.allSettled(workers.map((w) => w.close()));
		await failedJobsQueue.close();
		await connection.quit();
		process.exit(0);
	};

	process.on("SIGTERM", () => void shutdown("SIGTERM"));
	process.on("SIGINT", () => void shutdown("SIGINT"));

	console.log(`Workers started: ${workers.map((w) => w.name).join(", ")}`);
	return { workers, connection, failedJobsQueue };
}
