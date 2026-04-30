import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

import {
	invalidatePublicEventCache,
	invalidatePublicOrganizerCache,
	PUBLIC_EVENT_CACHE_KEY_PREFIX,
	PUBLIC_ORGANIZER_CACHE_KEY_PREFIX,
	singleFlight,
} from "../../src/lib/cache-stampede.js";

/**
 * In-memory FakeRedis mimicking only the surface area `singleFlight`
 * touches: `get`, `set` (with optional `PX`/`NX`), `setex`, `del`, and
 * `eval` (for the compare-and-delete release script). Behaviour-only —
 * no `keyPrefix` rewrite, since the helper passes the key string we
 * record as-is.
 */
class FakeRedis {
	store = new Map<string, { value: string; expiresAt: number | null }>();
	getCalls = 0;
	setCalls = 0;
	setexCalls: Array<{ key: string; ttl: number; value: string }> = [];
	evalCalls = 0;
	delCalls = 0;

	private readNoExpire(key: string): string | null {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}
		if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return null;
		}
		return entry.value;
	}

	get = vi.fn(async (key: string): Promise<string | null> => {
		this.getCalls += 1;
		return this.readNoExpire(key);
	});

	// ioredis `set(key, value, "PX", ms, "NX")` returns "OK" on success
	// and `null` when the NX guard rejects the write.
	set = vi.fn(
		async (
			key: string,
			value: string,
			...rest: unknown[]
		): Promise<"OK" | null> => {
			this.setCalls += 1;
			const px = rest.indexOf("PX");
			const nx = rest.includes("NX");
			const ttlMs =
				px >= 0 && typeof rest[px + 1] === "number"
					? (rest[px + 1] as number)
					: null;
			if (nx && this.readNoExpire(key) !== null) {
				return null;
			}
			this.store.set(key, {
				value,
				expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
			});
			return "OK";
		},
	);

	setex = vi.fn(
		async (key: string, ttlSec: number, value: string): Promise<"OK"> => {
			this.setexCalls.push({ key, ttl: ttlSec, value });
			this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
			return "OK";
		},
	);

	del = vi.fn(async (key: string): Promise<number> => {
		this.delCalls += 1;
		return this.store.delete(key) ? 1 : 0;
	});

	// Compare-and-delete: arguments are (script, numKeys, key, token).
	eval = vi.fn(
		async (
			_script: string,
			_numKeys: number,
			key: string,
			token: string,
		): Promise<number> => {
			this.evalCalls += 1;
			const entry = this.store.get(key);
			if (entry?.value === token) {
				this.store.delete(key);
				return 1;
			}
			return 0;
		},
	);
}

function asRedis(fake: FakeRedis): Redis {
	return fake as unknown as Redis;
}

describe("singleFlight", () => {
	it("short-circuits on a cache hit without touching the producer", async () => {
		const fake = new FakeRedis();
		fake.store.set("evt:slug:foo", {
			value: JSON.stringify({ title: "cached" }),
			expiresAt: null,
		});
		const producer = vi.fn(async () => {
			throw new Error("producer must not run on cache hit");
		});

		const result = await singleFlight(
			asRedis(fake),
			"evt:slug:foo",
			60,
			producer,
		);

		expect(result).toEqual({ title: "cached" });
		expect(producer).not.toHaveBeenCalled();
		expect(fake.set).not.toHaveBeenCalled();
		expect(fake.eval).not.toHaveBeenCalled();
	});

	it("leader runs the producer, writes via SETEX with the right TTL, then releases the lock via EVAL", async () => {
		const fake = new FakeRedis();
		const value = { hello: "world" };
		const producer = vi.fn(async () => value);

		const result = await singleFlight(
			asRedis(fake),
			"evt:slug:bar",
			42,
			producer,
		);

		expect(result).toBe(value);
		expect(producer).toHaveBeenCalledTimes(1);
		expect(fake.setexCalls).toEqual([
			{ key: "evt:slug:bar", ttl: 42, value: JSON.stringify(value) },
		]);
		// Lock was acquired with NX/PX and released through the Lua script.
		expect(fake.set).toHaveBeenCalledWith(
			"lock:evt:slug:bar",
			expect.any(String),
			"PX",
			expect.any(Number),
			"NX",
		);
		expect(fake.evalCalls).toBe(1);
	});

	it("five concurrent callers share one producer execution and all receive the leader's value", async () => {
		const fake = new FakeRedis();
		const producer = vi.fn(async () => {
			// Simulate a non-trivial DB round-trip so followers genuinely
			// race the leader through the polling loop.
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
			return { id: "shared" };
		});

		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				singleFlight(asRedis(fake), "evt:slug:hot", 60, producer, {
					pollIntervalMs: 1,
					lockTimeoutMs: 200,
				}),
			),
		);

		expect(producer).toHaveBeenCalledTimes(1);
		for (const result of results) {
			expect(result).toEqual({ id: "shared" });
		}
		// Exactly one cache write — the leader's. Followers must NOT write.
		expect(fake.setexCalls).toHaveLength(1);
	});

	it("treats cached `null` as a hit so followers don't stampede on the negative path", async () => {
		// Regression: the original `waitForLeader` returned `T | null` and
		// the follower branch did `if (leaderValue !== null) return …`. A
		// producer that legitimately caches `null` (the missing-slug branch
		// in `lookupPublicEventBySlug`) would defeat single-flight — every
		// follower would see `null`, mistake it for "no leader value yet",
		// and run the producer locally. Caught by the I-2.4.3 reviewer.
		const fake = new FakeRedis();
		const producer = vi.fn(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
			return null as { foo: string } | null;
		});

		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				singleFlight<{ foo: string } | null>(
					asRedis(fake),
					"evt:slug:missing",
					60,
					producer,
					{ pollIntervalMs: 1, lockTimeoutMs: 200 },
				),
			),
		);

		expect(producer).toHaveBeenCalledTimes(1);
		for (const result of results) {
			expect(result).toBeNull();
		}
		expect(fake.setexCalls).toHaveLength(1);
		expect(fake.setexCalls[0]?.value).toBe("null");
	});

	it("follower fails OPEN on lock timeout: runs producer locally, never writes", async () => {
		const fake = new FakeRedis();
		// Pre-occupy the lock as if a leader were running but never finishing.
		fake.store.set("lock:evt:slug:slow", {
			value: "stuck-leader-token",
			expiresAt: Date.now() + 60_000,
		});
		const producer = vi.fn(async () => ({ kind: "follower-result" }));

		const result = await singleFlight(
			asRedis(fake),
			"evt:slug:slow",
			60,
			producer,
			{ pollIntervalMs: 5, lockTimeoutMs: 30 },
		);

		expect(result).toEqual({ kind: "follower-result" });
		expect(producer).toHaveBeenCalledTimes(1);
		// CRITICAL: timed-out followers must never write — that would let
		// N followers overwrite a freshly-written leader value.
		expect(fake.setexCalls).toHaveLength(0);
		// And we never released the leader's lock (we don't own it).
		expect(fake.evalCalls).toBe(0);
	});

	it("propagates producer errors after releasing the lock and never writes the cache", async () => {
		const fake = new FakeRedis();
		const boom = new Error("db down");
		const producer = vi.fn(async () => {
			throw boom;
		});

		await expect(
			singleFlight(asRedis(fake), "evt:slug:err", 60, producer),
		).rejects.toBe(boom);

		expect(producer).toHaveBeenCalledTimes(1);
		expect(fake.setexCalls).toHaveLength(0);
		// Lock MUST be released even on failure (Lua compare-and-delete).
		expect(fake.evalCalls).toBe(1);
	});

	it("bypasses single-flight entirely when Redis GET throws", async () => {
		const fake = new FakeRedis();
		fake.get.mockRejectedValueOnce(new Error("redis offline"));
		const producer = vi.fn(async () => ({ ok: true }));

		const result = await singleFlight(
			asRedis(fake),
			"evt:slug:dead-redis",
			60,
			producer,
		);

		expect(result).toEqual({ ok: true });
		expect(producer).toHaveBeenCalledTimes(1);
		// We must not attempt to take a lock or write a cache entry when
		// Redis is unhealthy — bypass cleanly so the request still succeeds.
		expect(fake.set).not.toHaveBeenCalled();
		expect(fake.setexCalls).toHaveLength(0);
		expect(fake.evalCalls).toBe(0);
	});
});

describe("invalidatePublicEventCache / invalidatePublicOrganizerCache", () => {
	it("DELs the canonical event cache key", async () => {
		const fake = new FakeRedis();
		fake.store.set(`${PUBLIC_EVENT_CACHE_KEY_PREFIX}foo`, {
			value: "x",
			expiresAt: null,
		});

		const removed = await invalidatePublicEventCache(asRedis(fake), "foo");

		expect(removed).toBe(1);
		expect(fake.del).toHaveBeenCalledWith(
			`${PUBLIC_EVENT_CACHE_KEY_PREFIX}foo`,
		);
	});

	it("DELs the canonical organizer cache key", async () => {
		const fake = new FakeRedis();
		fake.store.set(`${PUBLIC_ORGANIZER_CACHE_KEY_PREFIX}acme`, {
			value: "x",
			expiresAt: null,
		});

		const removed = await invalidatePublicOrganizerCache(asRedis(fake), "acme");

		expect(removed).toBe(1);
		expect(fake.del).toHaveBeenCalledWith(
			`${PUBLIC_ORGANIZER_CACHE_KEY_PREFIX}acme`,
		);
	});
});
