import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createDatabase } from "@repo/db";
import type { FastifyBaseLogger } from "fastify";
import { createDLQHandler, QUEUE_NAMES } from "../lib/queue.js";
import { createRedisClient, REDIS_NAMESPACES } from "../lib/redis.js";
import {
	createSitemapRegenWorker,
	type SitemapRegenWorkerDeps,
} from "../queues/sitemap-regen.js";
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

export async function startWorkers(
	redisUrl?: string,
	razorpayDeps?: RazorpayAccountWorkerDeps,
	sitemapDeps?: SitemapRegenWorkerDeps,
) {
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
		...(razorpayDeps
			? [createRazorpayAccountWorker(connection, dlqHandler, razorpayDeps)]
			: []),
		// I-2.4.4: sitemap regen worker. Optional like razorpay — the
		// production direct-run entrypoint below builds and passes
		// `sitemapDeps`; tests can omit deps to keep the worker stack
		// minimal.
		...(sitemapDeps
			? [createSitemapRegenWorker(connection, dlqHandler, sitemapDeps)]
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

/**
 * I-2.4.4: build production sitemap regen worker deps from the
 * environment. Mirrors what `app.ts` wires for the API process: a DB
 * client (DATABASE_URL), a namespaced cache Redis client (the same
 * `cache:` prefix the route reads from), a logger, and the optional
 * CDN host. Kept here (not in `startWorkers`) so test callers that
 * pass their own `sitemapDeps` aren't forced to construct DB/Redis.
 */
function buildProductionSitemapDeps(): SitemapRegenWorkerDeps {
	const databaseUrl = getRequiredEnv("DATABASE_URL");
	const redisUrl = getRequiredEnv("REDIS_URL");
	// Mirror the console-shim pattern other workers use
	// (see workers/email.ts) — keeps deps light and avoids dragging
	// in a full pino instance into the worker entrypoint.
	const log = {
		info: console.info,
		warn: console.warn,
		error: console.error,
	} as unknown as FastifyBaseLogger;
	const db = createDatabase(databaseUrl);
	const cache = createRedisClient(redisUrl, {
		keyPrefix: REDIS_NAMESPACES.cache,
	});
	const cdnBaseUrl = process.env.CDN_BASE_URL;
	return {
		db,
		cache,
		log,
		...(cdnBaseUrl !== undefined ? { cdnBaseUrl } : {}),
	};
}

// Auto-start when run directly as entrypoint
const isDirectRun =
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith("workers/index.ts");

if (isDirectRun) {
	const sitemapDeps = (() => {
		try {
			return buildProductionSitemapDeps();
		} catch (err) {
			console.warn(
				"Sitemap regen worker disabled — failed to build deps:",
				err,
			);
			return undefined;
		}
	})();
	startWorkers(undefined, undefined, sitemapDeps).catch((error) => {
		console.error("Failed to start workers:", error);
		process.exit(1);
	});
}
