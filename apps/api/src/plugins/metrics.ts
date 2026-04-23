import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import {
	httpRequestDuration,
	httpRequestTotal,
	redisMemoryUsage,
	redisEvictedKeys,
	redisConnectedClients,
	queueDepth,
	queueOldestJobAge,
	queueDelayedJobs,
	queueFailedJobs,
	queueDlqDepth,
} from "../lib/metrics.js";
import { QUEUE_NAMES } from "../lib/queue.js";

/** Cached Redis server stats, updated by periodic INFO polling. */
interface RedisStats {
	usedMemoryBytes: number;
	evictedKeys: number;
	connectedClients: number;
}

/** Cached per-queue stats, updated by periodic polling. */
interface QueueStats {
	depth: number;
	oldestJobAgeSeconds: number;
	delayed: number;
	failed: number;
}

const REDIS_POLL_INTERVAL_MS = 30_000;
const QUEUE_POLL_INTERVAL_MS = 30_000;

/** Domain queues to poll (excludes the DLQ itself). */
const DOMAIN_QUEUES = [
	{ key: "paymentWebhook" as const, name: QUEUE_NAMES.paymentWebhook },
	{ key: "email" as const, name: QUEUE_NAMES.email },
	{ key: "cleanup" as const, name: QUEUE_NAMES.cleanup },
	{ key: "exports" as const, name: QUEUE_NAMES.exports },
];

/**
 * Parse a single numeric value from Redis INFO output.
 * INFO returns lines like `used_memory:1234\r\n`.
 */
function parseInfoValue(info: string, key: string): number {
	const regex = new RegExp(`^${key}:(\\d+)`, "m");
	const match = regex.exec(info);
	return match ? Number(match[1]) : 0;
}

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
	// ── HTTP request metrics via onResponse hook ────────────────────
	fastify.addHook("onResponse", async (request, reply) => {
		const duration = reply.elapsedTime;
		// Use Fastify's route template to avoid high-cardinality labels
		const route = request.routeOptions?.url ?? "unmatched";
		const method = request.method;
		const status = String(reply.statusCode);

		const attributes = { method, route, status };

		httpRequestDuration.record(duration, attributes);
		httpRequestTotal.add(1, attributes);
	});

	// ── Redis server metrics via periodic INFO polling ──────────────
	const cachedRedisStats: RedisStats = {
		usedMemoryBytes: 0,
		evictedKeys: 0,
		connectedClients: 0,
	};

	async function pollRedisInfo(): Promise<void> {
		try {
			const info = await fastify.redis.base.info();
			cachedRedisStats.usedMemoryBytes = parseInfoValue(
				info,
				"used_memory",
			);
			cachedRedisStats.evictedKeys = parseInfoValue(
				info,
				"evicted_keys",
			);
			cachedRedisStats.connectedClients = parseInfoValue(
				info,
				"connected_clients",
			);
		} catch {
			// Metrics should never break the app — swallow errors
			fastify.log.debug("Redis INFO poll failed (metrics)");
		}
	}

	// Register observable callbacks that read from the cache
	redisMemoryUsage.addCallback((result) => {
		result.observe(cachedRedisStats.usedMemoryBytes);
	});

	redisEvictedKeys.addCallback((result) => {
		result.observe(cachedRedisStats.evictedKeys);
	});

	redisConnectedClients.addCallback((result) => {
		result.observe(cachedRedisStats.connectedClients);
	});

	// Initial poll at startup, then periodic
	await pollRedisInfo();
	const redisPollInterval = setInterval(pollRedisInfo, REDIS_POLL_INTERVAL_MS);

	// ── BullMQ queue metrics via periodic polling ──────────────────
	const cachedQueueStats = new Map<string, QueueStats>();
	let cachedDlqDepth = 0;

	async function pollQueueStats(): Promise<void> {
		try {
			for (const { key, name } of DOMAIN_QUEUES) {
				const queue = fastify.queues[key];
				const counts = await queue.getJobCounts(
					"waiting",
					"active",
					"delayed",
					"failed",
				);
				const waiting = counts.waiting ?? 0;
				const active = counts.active ?? 0;
				const delayed = counts.delayed ?? 0;
				const failed = counts.failed ?? 0;

				let oldestAgeSeconds = 0;
				if (waiting > 0) {
					try {
						const jobs = await queue.getJobs(["waiting"], 0, 0);
						if (jobs.length > 0 && jobs[0]?.timestamp) {
							oldestAgeSeconds = (Date.now() - jobs[0].timestamp) / 1000;
						}
					} catch {
						// getJobs may fail on some Redis configs — skip age
					}
				}

				cachedQueueStats.set(name, {
					depth: waiting + active,
					oldestJobAgeSeconds: oldestAgeSeconds,
					delayed,
					failed,
				});
			}

			// DLQ total depth
			const dlqCounts = await fastify.queues.failedJobs.getJobCounts(
				"waiting",
				"active",
			);
			cachedDlqDepth = (dlqCounts.waiting ?? 0) + (dlqCounts.active ?? 0);
		} catch {
			fastify.log.debug("Queue stats poll failed (metrics)");
		}
	}

	// Register observable callbacks for queue metrics
	queueDepth.addCallback((result) => {
		for (const [name, stats] of cachedQueueStats) {
			result.observe(stats.depth, { queue: name });
		}
	});

	queueOldestJobAge.addCallback((result) => {
		for (const [name, stats] of cachedQueueStats) {
			result.observe(stats.oldestJobAgeSeconds, { queue: name });
		}
	});

	queueDelayedJobs.addCallback((result) => {
		for (const [name, stats] of cachedQueueStats) {
			result.observe(stats.delayed, { queue: name });
		}
	});

	queueFailedJobs.addCallback((result) => {
		for (const [name, stats] of cachedQueueStats) {
			result.observe(stats.failed, { queue: name });
		}
	});

	queueDlqDepth.addCallback((result) => {
		result.observe(cachedDlqDepth);
	});

	await pollQueueStats();
	const queuePollInterval = setInterval(
		pollQueueStats,
		QUEUE_POLL_INTERVAL_MS,
	);

	// Clean up on close
	fastify.addHook("onClose", async () => {
		clearInterval(redisPollInterval);
		clearInterval(queuePollInterval);
	});
};

export default fp(metricsPlugin, {
	name: "metrics",
	dependencies: ["redis", "queue"],
	fastify: "5.x",
});
