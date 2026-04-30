import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createCdnPurgeClient } from "../lib/cdn-invalidation.js";
import { createDLQHandler, QUEUE_NAMES } from "../lib/queue.js";
import { createCdnPurgeWorker } from "../queues/cdn-purge.js";
import { createCleanupWorker } from "./cleanup.js";
import { createEmailWorker } from "./email.js";
import { createExportsWorker } from "./exports.js";
import { createPaymentWebhookWorker } from "./payment-webhook.js";
import {
	createRazorpayAccountWorker,
	type RazorpayAccountWorkerDeps,
} from "./razorpay-account.js";

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

/**
 * Console logger shim for the worker bootstrap. The worker process
 * does not have a Fastify instance, so we adapt `console.*` to the
 * `Pick<FastifyBaseLogger, …>` shape used by the workers.
 *
 * IMPORTANT: never log sensitive config (the Cloudflare API token).
 * The CDN purge client only logs the zone ID + a `clientEnabled`
 * boolean, never the token itself.
 */
const workerLogger = {
	debug: (obj: unknown, msg?: string) => console.debug(msg ?? "", obj),
	info: (obj: unknown, msg?: string) => console.info(msg ?? "", obj),
	warn: (obj: unknown, msg?: string) => console.warn(msg ?? "", obj),
	error: (obj: unknown, msg?: string) => console.error(msg ?? "", obj),
};

export async function startWorkers(
	redisUrl?: string,
	razorpayDeps?: RazorpayAccountWorkerDeps,
) {
	const url = redisUrl ?? getRequiredEnv("REDIS_URL");

	const connection = new Redis(url, {
		maxRetriesPerRequest: null,
		enableOfflineQueue: true,
	});

	// DLQ queue for failed job tracking
	const failedJobsQueue = new Queue(QUEUE_NAMES.failedJobs, { connection });
	const dlqHandler = createDLQHandler(failedJobsQueue);

	// I-2.4.2: build the CDN purge client from env vars. When
	// CLOUDFLARE_PURGE_ENABLED is unset/false the client returns a
	// no-op stub — the worker still runs and consumes jobs (so the
	// queue topology is identical across deployments) but every job
	// becomes a debug log line. The cross-field config check in
	// `loadConfig` already prevents enabled=true with missing creds in
	// the API process; here in the worker process we re-derive the
	// boolean defensively from the env vars directly so the worker can
	// start even if `loadConfig` hasn't been called.
	//
	// Acceptance must match `loadConfig`'s `Type.Boolean()` coercion
	// (env-schema/ajv accepts "true"/"false"/"1"/"0") so an API enqueuing
	// jobs and a worker draining them never disagree about whether
	// purging is on.
	const purgeEnabledRaw = process.env.CLOUDFLARE_PURGE_ENABLED?.toLowerCase();
	const cdnPurgeClient = createCdnPurgeClient(
		{
			enabled: purgeEnabledRaw === "true" || purgeEnabledRaw === "1",
			zoneId: process.env.CLOUDFLARE_ZONE_ID,
			apiToken: process.env.CLOUDFLARE_API_TOKEN,
			baseUrl: process.env.CDN_BASE_URL,
		},
		workerLogger,
	);

	const workers = [
		createPaymentWebhookWorker(connection, dlqHandler),
		createEmailWorker(connection, dlqHandler),
		createCleanupWorker(connection, dlqHandler),
		createExportsWorker(connection, dlqHandler),
		createCdnPurgeWorker(connection, cdnPurgeClient, workerLogger, dlqHandler),
		...(razorpayDeps
			? [createRazorpayAccountWorker(connection, dlqHandler, razorpayDeps)]
			: []),
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
