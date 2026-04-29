import { Redis } from "ioredis";

export const REDIS_NAMESPACES = {
	session: "sess:",
	bull: "bull:", // BullMQ uses "bull" prefix internally; this documents the effective namespace
	rateLimit: "rl:",
	cache: "cache:",
	otp: "otp:",
} as const;

export type RedisNamespace = keyof typeof REDIS_NAMESPACES;

export interface RedisClients {
	/** Base connection (no prefix) — health checks, raw operations */
	base: Redis;
	/** Session storage (sess: prefix) */
	session: Redis;
	/** Rate limiting (rl: prefix) */
	rateLimit: Redis;
	/** Caching (cache: prefix) */
	cache: Redis;
	/** OTP storage (otp: prefix) */
	otp: Redis;
}

export interface CreateRedisClientOptions {
	keyPrefix?: string;
	lazyConnect?: boolean;
	connectTimeout?: number;
	enableOfflineQueue?: boolean;
	maxRetriesPerRequest?: number | null;
	retryStrategy?: (times: number) => number | null;
}

const DEFAULT_RETRY_CAP_MS = 2000;
const RETRY_BASE_MS = 50;
const STARTUP_CONNECT_TIMEOUT_MS = 1000;

export function createRedisClient(
	url: string,
	options: CreateRedisClientOptions = {},
): Redis {
	return new Redis(url, {
		keyPrefix: options.keyPrefix,
		lazyConnect: options.lazyConnect ?? false,
		connectTimeout: options.connectTimeout,
		maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
		retryStrategy(times: number) {
			if (options.retryStrategy) {
				return options.retryStrategy(times);
			}

			return Math.min(times * RETRY_BASE_MS, DEFAULT_RETRY_CAP_MS);
		},
		enableOfflineQueue: options.enableOfflineQueue ?? true,
	});
}

export async function pingRedis(url: string): Promise<void> {
	const probe = createRedisClient(url, {
		lazyConnect: true,
		connectTimeout: STARTUP_CONNECT_TIMEOUT_MS,
		enableOfflineQueue: false,
		maxRetriesPerRequest: 1,
		retryStrategy: () => null,
	});
	if (typeof probe.on === "function") {
		probe.on("error", () => {
			// The startup probe reports connection failures through the awaited command.
		});
	}

	try {
		if (typeof probe.connect === "function") {
			await probe.connect();
		}
		await probe.ping();
	} finally {
		if (typeof probe.disconnect === "function") {
			probe.disconnect();
		} else {
			void probe.quit();
		}
	}
}

export function createRedisClients(url: string): RedisClients {
	return {
		base: createRedisClient(url),
		session: createRedisClient(url, {
			keyPrefix: REDIS_NAMESPACES.session,
		}),
		rateLimit: createRedisClient(url, {
			keyPrefix: REDIS_NAMESPACES.rateLimit,
		}),
		cache: createRedisClient(url, { keyPrefix: REDIS_NAMESPACES.cache }),
		otp: createRedisClient(url, { keyPrefix: REDIS_NAMESPACES.otp }),
	};
}

/** Creates a raw ioredis connection for BullMQ (no keyPrefix — BullMQ manages its own prefix). */
export function createBullMQConnection(url: string): Redis {
	return createRedisClient(url);
}

export async function closeRedisClients(clients: RedisClients): Promise<void> {
	await Promise.allSettled([
		clients.base.quit(),
		clients.session.quit(),
		clients.rateLimit.quit(),
		clients.cache.quit(),
		clients.otp.quit(),
	]);
}
