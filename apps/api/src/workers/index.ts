import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { createDatabase } from "@repo/db";
import { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { Redis } from "ioredis";
import { createCdnPurgeClient } from "../lib/cdn-invalidation.js";
import { parseAbsoluteOrigin } from "../lib/config.js";
import { createDLQHandler, QUEUE_NAMES } from "../lib/queue.js";
import { createRedisClient, REDIS_NAMESPACES } from "../lib/redis.js";
import { createCdnPurgeWorker } from "../queues/cdn-purge.js";
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

let hasLoadedWorkerEnvFile = false;

function ensureWorkerEnvLoaded() {
	if (hasLoadedWorkerEnvFile) {
		return;
	}

	try {
		loadEnvFile();
	} catch (error) {
		const code =
			typeof error === "object" && error !== null && "code" in error
				? error.code
				: undefined;

		if (code !== "ENOENT") {
			throw error;
		}
	}

	hasLoadedWorkerEnvFile = true;
}

function getRequiredEnv(name: string): string {
	ensureWorkerEnvLoaded();

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

type CdnPurgeEnv = Partial<
	Record<
		| "CLOUDFLARE_API_TOKEN"
		| "CLOUDFLARE_PURGE_ENABLED"
		| "CLOUDFLARE_ZONE_ID"
		| "CDN_BASE_URL",
		string
	>
>;

export function createWorkerCdnPurgeConfig(env: CdnPurgeEnv = process.env) {
	const purgeEnabledRaw = env.CLOUDFLARE_PURGE_ENABLED?.toLowerCase();
	const purgeEnabled = purgeEnabledRaw === "true" || purgeEnabledRaw === "1";
	const parsedCdnBaseUrl =
		env.CDN_BASE_URL === undefined
			? undefined
			: parseAbsoluteOrigin(env.CDN_BASE_URL);

	if (purgeEnabled && env.CDN_BASE_URL !== undefined && !parsedCdnBaseUrl) {
		throw new Error(
			"Invalid configuration: CDN_BASE_URL must be an absolute origin without a path, query, or hash.",
		);
	}

	if (
		purgeEnabled &&
		(!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN || !parsedCdnBaseUrl)
	) {
		throw new Error(
			"Invalid configuration: CLOUDFLARE_PURGE_ENABLED is true but CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN, and CDN_BASE_URL must be set.",
		);
	}

	return {
		enabled: purgeEnabled,
		zoneId: env.CLOUDFLARE_ZONE_ID,
		apiToken: env.CLOUDFLARE_API_TOKEN,
		baseUrl: parsedCdnBaseUrl?.origin,
	};
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
		family: 0,
	});

	// DLQ queue for failed job tracking
	const failedJobsQueue = new Queue(QUEUE_NAMES.failedJobs, { connection });
	const dlqHandler = createDLQHandler(failedJobsQueue);

	// I-2.4.2: build the CDN purge client from env vars. When
	// CLOUDFLARE_PURGE_ENABLED is unset/false the client returns a
	// no-op stub — the worker still runs and consumes jobs (so the
	// queue topology is identical across deployments) but every job
	// becomes a debug log line. The worker process does not call
	// `loadConfig`, so it repeats the fail-closed check here rather than
	// consuming purge jobs with a disabled client.
	//
	// Acceptance must match `loadConfig`'s `Type.Boolean()` coercion
	// (env-schema/ajv accepts "true"/"false"/"1"/"0") so an API enqueuing
	// jobs and a worker draining them never disagree about whether
	// purging is on.
	const cdnPurgeClient = createCdnPurgeClient(
		createWorkerCdnPurgeConfig(),
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

/**
 * Returns true when this module is being executed directly as the
 * Node entrypoint (rather than imported). Exposed for unit testing —
 * callers should pass `process.argv[1]` and `import.meta.url`.
 *
 * Uses `pathToFileURL` so it works regardless of OS path style and
 * regardless of whether the entrypoint is `.ts` (tsx) or `.js`
 * (compiled `dist/`).
 */
export function isWorkerDirectRun(
	argv1: string | undefined,
	importMetaUrl: string,
): boolean {
	if (argv1 === undefined) {
		return false;
	}

	try {
		return importMetaUrl === pathToFileURL(argv1).href;
	} catch {
		return false;
	}
}

// Auto-start when run directly as entrypoint
const isDirectRun = isWorkerDirectRun(process.argv[1], import.meta.url);

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
