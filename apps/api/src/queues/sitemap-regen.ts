import type { Database } from "@repo/db";
import type { Queue, Worker } from "bullmq";
import { Worker as BullWorker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { QUEUE_CONFIGS, QUEUE_NAMES } from "../lib/queue.js";
import {
	SITEMAP_CACHE_KEY,
	SITEMAP_CACHE_TTL_SEC,
} from "../modules/sitemap/routes.js";
import { buildSitemapXml } from "../modules/sitemap/service.js";

/**
 * I-2.4.4 — `sitemap-regen` BullMQ wiring.
 *
 * Three callers add work to this queue:
 *   1. **Cron repeatable** — `scheduleSitemapRegenCron` registers a
 *      nightly `0 3 * * *` UTC tick at API startup.
 *   2. **Publish/unpublish hook** — `invalidateEventCache` calls
 *      `enqueueSitemapRegen` from `events/service.ts` after a
 *      successful publish/unpublish/admin-approve/published-edit
 *      mutation. Every ad-hoc enqueue uses the SAME `jobId`
 *      (`SITEMAP_REGEN_DEBOUNCE_JOB_ID`) so a burst of publishes
 *      coalesces into one regen — BullMQ rejects duplicate `jobId`s.
 *   3. **Manual ops** — `enqueueSitemapRegen(queue)` is exposed for
 *      future admin tooling. No-ops cleanly when `queue` is undefined
 *      (test stubs / partial configurations).
 *
 * Worker contract: regenerate the XML and SETEX it under
 * `cache:sitemap:current` with TTL 25h (matches the route handler).
 * Errors propagate so BullMQ retries per `QUEUE_CONFIGS` (2 attempts,
 * exponential backoff). The worker NEVER touches Cloudflare directly
 * — the I-2.4.2 cdn-purge wiring (separate Wave-B agent) will, when
 * it lands, also enqueue a purge for the sitemap URL.
 */

export const SITEMAP_REGEN_JOB_NAME = "regenerate";

/**
 * Shared `jobId` used by every ad-hoc enqueue. BullMQ rejects (returns
 * the existing job) any second add with the same `jobId` while the
 * job is still in waiting/active state — that's our debounce. Once the
 * job completes and is removed (required queue config:
 * `removeOnComplete: true` for this fixed-`jobId` debounce pattern),
 * the next enqueue creates a fresh job with the same id. The cron job
 * uses a *different* id (managed by BullMQ's repeatable-jobs
 * subsystem) so the two never collide.
 */
export const SITEMAP_REGEN_DEBOUNCE_JOB_ID = "sitemap-regen-debounce";

/** Fixed pattern for the nightly regen — 03:00 UTC daily. */
export const SITEMAP_REGEN_CRON_PATTERN = "0 3 * * *";

export interface EnqueueSitemapRegenOptions {
	/**
	 * Override the debounce job-id. Defaults to
	 * `SITEMAP_REGEN_DEBOUNCE_JOB_ID`. Tests use this to exercise the
	 * dedup contract; production callers should leave it unset.
	 */
	jobId?: string;
	/** Optional source label for observability — written to job data. */
	reason?: string;
}

/**
 * Enqueue a debounced sitemap-regen job. Safe to call when `queue` is
 * `undefined` (no-op) — that's the contract `invalidateEventCache`
 * relies on so tests don't have to wire the full queue stack.
 *
 * Returns the BullMQ job promise (or undefined when no-op'd) so callers
 * can `void` it explicitly. Errors are NOT swallowed here — the
 * caller decides whether enqueue failure should bubble (publish flow
 * handles this with its own try/catch).
 */
export function enqueueSitemapRegen(
	queue: Queue | undefined,
	opts: EnqueueSitemapRegenOptions = {},
): Promise<unknown> | undefined {
	if (!queue) return undefined;
	const jobId = opts.jobId ?? SITEMAP_REGEN_DEBOUNCE_JOB_ID;
	const data = opts.reason ? { reason: opts.reason } : {};
	return queue.add(SITEMAP_REGEN_JOB_NAME, data, { jobId });
}

/**
 * Register the nightly cron tick on the queue. Idempotent: BullMQ
 * upserts the repeatable definition so calling on every API boot is
 * safe. The repeatable produces one job per cron tick whose id is
 * managed internally by BullMQ (NOT the debounce id) — so a manual
 * publish-driven regen and the cron tick can co-exist in flight if
 * the cron lands during a burst.
 */
export async function scheduleSitemapRegenCron(
	queue: Queue,
	pattern: string = SITEMAP_REGEN_CRON_PATTERN,
): Promise<void> {
	await queue.add(
		SITEMAP_REGEN_JOB_NAME,
		{ reason: "cron" },
		{
			repeat: { pattern, tz: "UTC" },
			// Don't share the debounce id — repeatable jobs need their
			// own deterministic id which BullMQ derives from the
			// repeat options. Forcing an id here would break the
			// repeatable bookkeeping.
		},
	);
}

type DLQHandler = (
	job:
		| {
				id?: string;
				name: string;
				queueName: string;
				data: unknown;
				attemptsMade: number;
				opts: { attempts?: number };
		  }
		| undefined,
	error: Error,
) => Promise<void>;

export interface SitemapRegenWorkerDeps {
	db: Pick<Database, "select">;
	/** `app.redis.cache` — namespaced (`cache:`) ioredis client. */
	cache: Redis;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	cdnBaseUrl?: string;
}

/**
 * Worker factory — the runtime processor that consumes regen jobs.
 * Lives in `workers/index.ts` for orchestration but the factory is
 * here so the queue + processor are co-located and can share
 * constants without a circular import via `lib/`.
 */
export function createSitemapRegenWorker(
	connection: Redis,
	onFailed: DLQHandler,
	deps: SitemapRegenWorkerDeps,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.sitemapRegen];
	const worker = new BullWorker(
		QUEUE_NAMES.sitemapRegen,
		async (job) => {
			const start = Date.now();
			const xml = await buildSitemapXml({
				db: deps.db,
				log: deps.log,
				...(deps.cdnBaseUrl !== undefined
					? { cdnBaseUrl: deps.cdnBaseUrl }
					: {}),
			});

			// SETEX under the same key the route handler reads. The
			// route's `singleFlight` will pick this up on the next
			// request without re-running the producer. Failure here
			// must propagate so BullMQ retries — silently swallowing
			// would let stale XML persist for a full TTL window.
			//
			// IMPORTANT: `singleFlight` (lib/cache-stampede.ts) reads
			// the cached value via `JSON.parse`, so the writer MUST
			// JSON.stringify. Writing raw XML here would silently
			// defeat the worker — every route hit would parse-fail,
			// fall through to the producer, and treat the worker's
			// regenerated value as corrupt. Tested at routes.test.ts.
			await deps.cache.setex(
				SITEMAP_CACHE_KEY,
				SITEMAP_CACHE_TTL_SEC,
				JSON.stringify(xml),
			);

			deps.log.info(
				{
					jobId: job.id,
					reason: (job.data as { reason?: string })?.reason ?? "unknown",
					durationMs: Date.now() - start,
					bytes: xml.length,
				},
				"sitemap regen completed",
			);
		},
		{ connection, concurrency: config.concurrency },
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
