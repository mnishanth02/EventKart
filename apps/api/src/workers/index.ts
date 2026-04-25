import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createDLQHandler, QUEUE_NAMES } from "../lib/queue.js";
import { createCleanupWorker } from "./cleanup.js";
import { createEmailWorker } from "./email.js";
import { createExportsWorker } from "./exports.js";
import { createPaymentWebhookWorker } from "./payment-webhook.js";

// Worker service entry point — runs as a separate Railway service.
// Usage: pnpm --filter api start:worker

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Required environment variable ${name} is not set. Workers cannot start without it.`,
		);
	}
	return value;
}

export async function startWorkers(redisUrl?: string) {
	const url = redisUrl ?? getRequiredEnv("REDIS_URL");

	const connection = new Redis(url, {
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

// Auto-start when run directly as entrypoint
const isDirectRun =
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith("workers/index.ts");

if (isDirectRun) {
	startWorkers().catch((error) => {
		console.error("Failed to start workers:", error);
		process.exit(1);
	});
}
