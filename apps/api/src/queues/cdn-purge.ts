import { type Job, Queue, Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";

import type { CdnPurgeClient } from "../lib/cdn-invalidation.js";
import { QUEUE_CONFIGS, QUEUE_NAMES } from "../lib/queue.js";

/**
 * BullMQ wiring for the I-2.4.2 Cloudflare cache-purge feature.
 *
 *  - Queue name `cdn-purge` (sibling to `email`, `cleanup`, …).
 *  - Job payload: `{urls?, tags?, reason, correlationId?}` — `reason`
 *    is REQUIRED so the audit trail can answer "why did we purge X?".
 *  - Retry: 3 attempts, exponential backoff 5s → 60s (capped). The
 *    Cloudflare purge endpoint is rate-limited to 1000/5min (operations
 *    doc §5); a transient 429 should retry, not flood.
 *  - Concurrency: 5. The Cloudflare API tolerates well-above this; the
 *    cap exists so a single bad config doesn't pin all worker slots.
 *
 * `enqueueCdnPurge` is a fail-soft helper: if the queue is undefined
 * (e.g. tests, or a deployment running with the queue plugin disabled)
 * it logs a debug line and returns. Mutation paths must NEVER fail
 * because the purge couldn't be scheduled.
 */

export interface CdnPurgePayload {
	/** Absolute URLs to purge. Optional — at least one of urls/tags must be set. */
	urls?: string[] | undefined;
	/** Cache-Tags to purge (Enterprise feature). */
	tags?: string[] | undefined;
	/** Why the purge was scheduled. Required for traceability — used in worker logs. */
	reason: string;
	/** Optional request/correlation ID forwarded from the originating Fastify request. */
	correlationId?: string | undefined;
}

/** Queue name constant — kept here so callers don't reach into `lib/queue.ts`. */
export const CDN_PURGE_QUEUE_NAME = QUEUE_NAMES.cdnPurge;

/** Job-name constant. BullMQ requires a name even when there's only one. */
export const CDN_PURGE_JOB_NAME = "purge";

/**
 * Enqueue a purge job. No-ops (with a debug log) when `queue` is
 * undefined — tests and the disabled-by-config path both exercise this
 * branch and must remain green.
 *
 * Returns the job's id when enqueued, `null` when skipped.
 */
export async function enqueueCdnPurge(
	queue: Queue<CdnPurgePayload> | undefined,
	payload: CdnPurgePayload,
	logger?: Partial<Pick<FastifyBaseLogger, "debug" | "warn">>,
): Promise<string | null> {
	if (!queue) {
		logger?.debug?.(
			{
				event: "cdn_purge_enqueue_skipped",
				reason: "queue_undefined",
				purgeReason: payload.reason,
			},
			"CDN purge enqueue skipped (queue not configured)",
		);
		return null;
	}

	if (
		(!payload.urls || payload.urls.length === 0) &&
		(!payload.tags || payload.tags.length === 0)
	) {
		logger?.debug?.(
			{ event: "cdn_purge_enqueue_skipped", reason: "empty_payload" },
			"CDN purge enqueue skipped (no urls or tags)",
		);
		return null;
	}

	try {
		const job = await queue.add(CDN_PURGE_JOB_NAME, payload);
		return job.id ?? null;
	} catch (err) {
		// Enqueue failure (Redis blip, queue closed) must not surface to
		// the caller — the originating mutation has already committed.
		logger?.warn?.(
			{ event: "cdn_purge_enqueue_failed", err: String(err) },
			"Failed to enqueue CDN purge job (mutation already committed)",
		);
		return null;
	}
}

/** Worker dependency surface — narrow on purpose for testability. */
type WorkerLogger = Pick<FastifyBaseLogger, "debug" | "info" | "warn" | "error">;

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

/**
 * Build the BullMQ worker. Wired into the worker bootstrap when CDN
 * purge is enabled. The worker delegates the actual HTTP call to the
 * `CdnPurgeClient` (which already implements chunking + best-effort
 * error handling); the worker only contributes structured logging,
 * timing, and BullMQ's built-in retry semantics.
 *
 * IMPORTANT: when the client is the no-op stub (`enabled === false`),
 * the worker still runs but every job becomes a debug log line — there
 * is no Cloudflare API call. This keeps the queue topology identical
 * across enabled/disabled deployments.
 */
export function createCdnPurgeWorker(
	connection: Redis,
	client: CdnPurgeClient,
	logger: WorkerLogger,
	onFailed?: DLQHandler,
): Worker<CdnPurgePayload> {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.cdnPurge];

	const worker = new Worker<CdnPurgePayload>(
		CDN_PURGE_QUEUE_NAME,
		async (job: Job<CdnPurgePayload>) => {
			const { urls, tags, reason, correlationId } = job.data;
			const start = Date.now();
			let success = false;
			try {
				if (urls && urls.length > 0) {
					await client.purgeUrls(urls);
				}
				if (tags && tags.length > 0) {
					await client.purgeTags(tags);
				}
				success = true;
			} finally {
				logger.info?.(
					{
						event: "cdn_purge",
						success,
						urls: urls ?? [],
						tags: tags ?? [],
						reason,
						correlationId,
						jobId: job.id,
						attempt: job.attemptsMade + 1,
						durationMs: Date.now() - start,
						clientEnabled: client.enabled,
					},
					success
						? "CDN purge job completed"
						: "CDN purge job threw before completion",
				);
			}
		},
		{ connection, concurrency: config.concurrency },
	);

	if (onFailed) {
		worker.on("failed", (job, err) => void onFailed(job, err));
	}

	return worker;
}
