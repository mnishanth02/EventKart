import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import {
	httpRequestDuration,
	httpRequestTotal,
	redisMemoryUsage,
	redisEvictedKeys,
	redisConnectedClients,
} from "../lib/metrics.js";

/** Cached Redis server stats, updated by periodic INFO polling. */
interface RedisStats {
	usedMemoryBytes: number;
	evictedKeys: number;
	connectedClients: number;
}

const REDIS_POLL_INTERVAL_MS = 30_000;

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
	const pollInterval = setInterval(pollRedisInfo, REDIS_POLL_INTERVAL_MS);

	// Clean up on close
	fastify.addHook("onClose", async () => {
		clearInterval(pollInterval);
	});
};

export default fp(metricsPlugin, {
	name: "metrics",
	dependencies: ["redis"],
	fastify: "5.x",
});
