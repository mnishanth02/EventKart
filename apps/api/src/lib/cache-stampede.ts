import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";

/**
 * Single-flight / cache-stampede prevention helper (I-2.4.3).
 *
 * Sits in front of an expensive `producer` (typically a multi-step DB
 * projection that backs a SSR page). Pattern:
 *
 *  1. `GET cache:<key>` — serve a cached JSON snapshot if present.
 *  2. `SET lock:<key> <token> NX PX <lockTtlMs>` — exactly one caller (the
 *     *leader*) wins the lock; runs the producer; `SETEX cache:<key>`s the
 *     result; releases the lock with a Lua compare-and-delete so we never
 *     `DEL` somebody else's token (defensive against TTL expiry mid-flight).
 *  3. *Followers* poll the cache key every `pollIntervalMs` for up to
 *     `lockTimeoutMs`. On hit they return the leader's value. On timeout
 *     they fail-OPEN and run the producer locally **without writing**
 *     (avoids thundering writes; caps tail latency if the leader crashed).
 *
 * Errors are NEVER cached — the leader releases its lock and propagates.
 *
 * Redis must be the namespaced cache client (`app.redis.cache`); its
 * `keyPrefix: "cache:"` is added automatically, so the effective Redis
 * keys become `cache:<key>` for the value and `cache:lock:<key>` for the
 * lock. (The lock prefix is intentional — it scopes locks to the cache
 * namespace and makes them easy to spot in `MONITOR`.)
 */

export interface SingleFlightOptions {
	/** How long the leader holds the lock before Redis auto-expires it. */
	lockTtlMs?: number;
	/** Follower poll interval. */
	pollIntervalMs?: number;
	/** How long followers wait before failing-OPEN. */
	lockTimeoutMs?: number;
}

const DEFAULT_LOCK_TTL_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 50;
const DEFAULT_LOCK_TIMEOUT_MS = 2_000;

/** Lock-key prefix kept inside the cache namespace so a single `KEYS cache:*` lookup surfaces both. */
const LOCK_KEY_PREFIX = "lock:";

/** Public-event cache key namespace. Bare key — caller's `keyPrefix: "cache:"` is applied by ioredis. */
export const PUBLIC_EVENT_CACHE_KEY_PREFIX = "evt:slug:";
/** Public-organizer cache key namespace. */
export const PUBLIC_ORGANIZER_CACHE_KEY_PREFIX = "org:slug:";

/**
 * Compare-and-delete: only `DEL` if the value at KEYS[1] still matches our
 * token. Prevents a leader whose lock expired (slow producer, network
 * stall) from accidentally releasing the *next* leader's lock.
 */
const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

function buildLockKey(key: string): string {
	return `${LOCK_KEY_PREFIX}${key}`;
}

function generateToken(): string {
	return randomBytes(16).toString("hex");
}

/**
 * Try to read a cached value. Returns `undefined` to signal "Redis is
 * unhealthy or returned an unparseable payload" so the caller can bypass
 * the lock dance entirely. Returns `null` for an explicit cache miss.
 */
async function readCache<T>(
	redis: Redis,
	key: string,
): Promise<{ ok: true; value: T } | { ok: false } | { miss: true }> {
	const raw = await redis.get(key);
	if (raw === null) {
		return { miss: true };
	}
	try {
		return { ok: true, value: JSON.parse(raw) as T };
	} catch {
		// Corrupted entry — treat as a miss so we re-populate. Don't crash
		// the request because somebody hand-edited a Redis key.
		return { ok: false };
	}
}

async function tryAcquireLock(
	redis: Redis,
	lockKey: string,
	token: string,
	lockTtlMs: number,
): Promise<boolean> {
	const result = await redis.set(lockKey, token, "PX", lockTtlMs, "NX");
	return result === "OK";
}

async function releaseLock(
	redis: Redis,
	lockKey: string,
	token: string,
): Promise<void> {
	try {
		await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
	} catch {
		// The lock will TTL out — never let release failure surface to the
		// caller; their producer already succeeded (or already threw).
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Poll the cache key until it appears or `lockTimeoutMs` elapses.
 * Returns the parsed value on hit, or `null` on timeout.
 */
async function waitForLeader<T>(
	redis: Redis,
	key: string,
	lockTimeoutMs: number,
	pollIntervalMs: number,
): Promise<T | null> {
	const deadline = Date.now() + lockTimeoutMs;
	// Guarantee at least one poll even when lockTimeoutMs is 0.
	let firstPass = true;
	while (firstPass || Date.now() < deadline) {
		firstPass = false;
		const raw = await redis.get(key);
		if (raw !== null) {
			try {
				return JSON.parse(raw) as T;
			} catch {
				return null;
			}
		}
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			break;
		}
		await sleep(Math.min(pollIntervalMs, remaining));
	}
	return null;
}

export async function singleFlight<T>(
	redis: Redis,
	key: string,
	ttlSec: number,
	producer: () => Promise<T>,
	opts?: SingleFlightOptions,
): Promise<T> {
	const lockTtlMs = opts?.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
	const pollIntervalMs = opts?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
	const lockTimeoutMs = opts?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;

	// 1. Cache hit short-circuit. If Redis is unhealthy here we bypass
	//    the entire single-flight path — running the producer directly is
	//    strictly better than failing the request because Redis is down.
	let cached: Awaited<ReturnType<typeof readCache<T>>>;
	try {
		cached = await readCache<T>(redis, key);
	} catch {
		return producer();
	}
	if ("ok" in cached && cached.ok) {
		return cached.value;
	}

	// 2. Try to become the leader.
	const lockKey = buildLockKey(key);
	const token = generateToken();
	let acquired: boolean;
	try {
		acquired = await tryAcquireLock(redis, lockKey, token, lockTtlMs);
	} catch {
		// Redis tripped between GET and SET — bypass.
		return producer();
	}

	if (acquired) {
		try {
			const value = await producer();
			try {
				await redis.setex(key, ttlSec, JSON.stringify(value));
			} catch {
				// Could not write — value is still correct for *this* caller;
				// the next request will re-run the producer. Don't fail.
			}
			return value;
		} finally {
			await releaseLock(redis, lockKey, token);
		}
	}

	// 3. Follower path: poll the cache key for the leader's value.
	let leaderValue: T | null;
	try {
		leaderValue = await waitForLeader<T>(
			redis,
			key,
			lockTimeoutMs,
			pollIntervalMs,
		);
	} catch {
		return producer();
	}
	if (leaderValue !== null) {
		return leaderValue;
	}

	// 4. Fail-OPEN: the leader is taking too long (or crashed). Run the
	//    producer locally but DO NOT write — late writes from a swarm of
	//    timed-out followers would stomp each other.
	return producer();
}

export function invalidatePublicEventCache(
	redis: Redis,
	slug: string,
): Promise<number> {
	return redis.del(`${PUBLIC_EVENT_CACHE_KEY_PREFIX}${slug}`);
}

export function invalidatePublicOrganizerCache(
	redis: Redis,
	slug: string,
): Promise<number> {
	return redis.del(`${PUBLIC_ORGANIZER_CACHE_KEY_PREFIX}${slug}`);
}
