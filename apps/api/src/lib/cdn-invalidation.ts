import type { FastifyBaseLogger } from "fastify";

/**
 * Cloudflare CDN cache-purge client (I-2.4.2).
 *
 * The Cloudflare zone-level `purge_cache` endpoint accepts up to 30
 * URLs per request and is rate-limited to 1000 purges per 5 minutes
 * (see `docs/operations/cloudflare-cdn-setup.md` §5). Both limits are
 * defended in this module:
 *
 *  - URL chunking: callers may pass any number of URLs; this client
 *    splits them into batches of `MAX_URLS_PER_REQUEST` (30) before
 *    POSTing.
 *  - Best-effort at the mutation boundary: `enqueueCdnPurge` (the
 *    only call site reachable from a request handler) wraps `queue.add`
 *    in try/catch and never throws. Inside the BullMQ worker, however,
 *    `purgeUrls`/`purgeTags` DO throw on Cloudflare error so the
 *    configured `attempts: 3` + exponential backoff and the DLQ
 *    handler actually run. A transient API blip therefore retries
 *    inside the queue without blocking the publishing request.
 *  - Fail-soft when disabled: if `enabled === false` OR
 *    `zoneId`/`apiToken`/`baseUrl` is missing, we return a no-op stub
 *    that logs at debug level. This keeps dev/test green when the
 *    Cloudflare env vars are unset and matches the cross-field config
 *    check in `loadConfig` (which already prevents enabled-but-missing).
 *  - Token confidentiality: the API token is NEVER included in any log
 *    line (we only log the redacted boolean `enabled` and the zone ID).
 *
 * The `eventCacheUrls`/`organizerCacheUrls`/`sitemapCacheUrls` helpers
 * derive the correct CDN URLs from a slug + base URL. Query strings are
 * stripped before being submitted because Cloudflare ignores them when
 * matching cached entries (the cache key in §3.1 of the operations doc
 * is configured as "ignore query string").
 */

export interface CdnPurgeConfig {
	zoneId?: string | undefined;
	apiToken?: string | undefined;
	enabled: boolean;
	baseUrl?: string | undefined;
}

export interface CdnPurgeClient {
	/** Purge a list of URLs. Chunks into ≤30/request. Throws `CdnPurgeError` on Cloudflare failure (worker retries). */
	purgeUrls(urls: string[]): Promise<void>;
	/** Purge by Cloudflare Cache-Tag (Enterprise feature). Throws on failure (worker retries). */
	purgeTags(tags: string[]): Promise<void>;
	/** True when the client will actually call Cloudflare. False = no-op stub. */
	readonly enabled: boolean;
}

/**
 * Cloudflare's documented per-request URL limit. Exceeding it returns
 * `400 You may only purge up to 30 files per API call`. We chunk on
 * the client side so callers never have to think about it.
 */
export const MAX_URLS_PER_REQUEST = 30;

/**
 * Per-request HTTP timeout. Cloudflare normally responds in <500ms;
 * a >10s outage almost always means an edge issue and we'd rather
 * surface as a TimeoutError that triggers retry than pin a worker
 * slot indefinitely. With concurrency 5, five hangs would otherwise
 * starve the entire `cdn-purge` queue.
 */
export const CDN_PURGE_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Thrown by `CdnPurgeClient.purgeUrls`/`purgeTags` when one or more
 * Cloudflare API chunks fail. The BullMQ worker propagates this so
 * the configured `attempts: 3` + exponential backoff actually run.
 *
 * Important: this MUST never reach the request-handling code path.
 * `enqueueCdnPurge` (the only call site reachable from a mutation
 * handler) wraps `queue.add` in try/catch — once a job is on the
 * queue, all retry/DLQ semantics live in the worker.
 */
export class CdnPurgeError extends Error {
	readonly reasons: readonly string[];
	constructor(message: string, reasons: readonly string[]) {
		super(message);
		this.name = "CdnPurgeError";
		this.reasons = reasons;
	}
}

/** Cloudflare zone-level purge endpoint template. */
const PURGE_ENDPOINT = (zoneId: string) =>
	`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

/** Logger surface this module needs — narrow on purpose so tests can pass plain mocks. */
type CdnLogger = Pick<FastifyBaseLogger, "debug" | "info" | "warn" | "error">;

/**
 * Strip query string + hash. Cloudflare's purge_files matches the path
 * portion of cached responses; the cache key in §3.1 of the operations
 * doc is "ignore query string". Sending `?utm_source=…` would silently
 * not match and waste a purge slot in the 1000/5min budget.
 */
export function stripQueryString(url: string): string {
	try {
		const parsed = new URL(url);
		// Mutate in place rather than rebuilding — preserves origin casing.
		parsed.search = "";
		parsed.hash = "";
		return parsed.toString();
	} catch {
		// If the URL is unparseable, drop the suffix manually as a fallback.
		// We must never crash the worker over a malformed input.
		const hashIdx = url.indexOf("#");
		const noHash = hashIdx === -1 ? url : url.slice(0, hashIdx);
		const queryIdx = noHash.indexOf("?");
		return queryIdx === -1 ? noHash : noHash.slice(0, queryIdx);
	}
}

/** Split an array into chunks of at most `size` items. */
function chunk<T>(items: T[], size: number): T[][] {
	if (size <= 0) {
		throw new RangeError("chunk size must be positive");
	}
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

/**
 * Build a CDN URL list for an event detail page. Returns an array even
 * for a single URL so the worker contract is uniform (`urls: string[]`).
 *
 * Note: `/events` listing routes are NOT included today — they are not
 * served as SSR-cached HTML at the edge (see operations doc §3.1, only
 * `/events/:slug` and `/organizers/:slug` are cached). When a future
 * listing route becomes cacheable, extend this helper rather than the
 * call sites.
 */
export function eventCacheUrls(baseUrl: string, slug: string): string[] {
	const trimmedBase = baseUrl.replace(/\/+$/, "");
	const safeSlug = encodeURIComponent(slug);
	return [`${trimmedBase}/events/${safeSlug}`];
}

/**
 * Build a CDN URL list for an organizer detail page. Includes the
 * organizer profile route only — there is no cached listing endpoint
 * keyed on `?organizerSlug=…` today (the homepage `/` is excluded from
 * caching per operations doc §3.1).
 */
export function organizerCacheUrls(baseUrl: string, slug: string): string[] {
	const trimmedBase = baseUrl.replace(/\/+$/, "");
	const safeSlug = encodeURIComponent(slug);
	return [`${trimmedBase}/organizers/${safeSlug}`];
}

/**
 * Build the sitemap purge URL list. I-2.4.4 owns sitemap generation;
 * this helper exists here so event mutations can purge `/sitemap.xml`
 * alongside the affected event detail page in a single enqueue.
 */
export function sitemapCacheUrls(baseUrl: string): string[] {
	const trimmedBase = baseUrl.replace(/\/+$/, "");
	return [`${trimmedBase}/sitemap.xml`];
}

/**
 * Cloudflare success envelope. We only need `success` + `errors[]` for
 * structured logging; `result` is opaque on success.
 */
interface CloudflareResponseEnvelope {
	success: boolean;
	errors?: Array<{ code: number; message: string }>;
	messages?: Array<{ code: number; message: string }>;
}

/**
 * No-op stub returned when the client is disabled. We keep the same
 * `enabled` flag on the object so call sites and tests can introspect
 * without checking the config.
 */
function noopClient(logger: CdnLogger, reason: string): CdnPurgeClient {
	return {
		enabled: false,
		async purgeUrls(urls: string[]): Promise<void> {
			logger.debug?.(
				{ event: "cdn_purge_skipped", reason, urlCount: urls.length },
				"CDN purge skipped (client disabled)",
			);
		},
		async purgeTags(tags: string[]): Promise<void> {
			logger.debug?.(
				{ event: "cdn_purge_skipped", reason, tagCount: tags.length },
				"CDN purge skipped (client disabled)",
			);
		},
	};
}

/**
 * POST one chunk to Cloudflare. Returns success/failure as a tagged
 * union so the caller decides whether to log warn or info — never
 * throws (the caller aggregates failure across chunks and surfaces a
 * single thrown error to the worker; the fail-soft contract lives at
 * `enqueueCdnPurge`, not here).
 */
async function postPurge(
	endpoint: string,
	apiToken: string,
	body: { files?: string[]; tags?: string[] },
	logger: CdnLogger,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: {
				// Token is sent only over TLS to api.cloudflare.com — never logged.
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			// Hard cap so a hung Cloudflare connection cannot pin a worker
			// slot indefinitely (concurrency 5 + 5 hangs = queue starvation).
			// AbortError surfaces in the catch below as a network failure,
			// which after fix #1 will throw and trigger BullMQ retry.
			signal: AbortSignal.timeout(CDN_PURGE_REQUEST_TIMEOUT_MS),
		});
	} catch (err) {
		// Network-level failure (DNS, connection refused, timeout) — return
		// for the worker layer to retry. NEVER throw from this function.
		const reason =
			err instanceof Error && err.name === "TimeoutError"
				? "timeout"
				: "network_error";
		logger.warn?.(
			{ event: "cdn_purge_network_error", err: String(err), reason },
			"Cloudflare purge request failed at the network layer",
		);
		return { ok: false, reason };
	}

	if (!response.ok) {
		// Read up to 1KB so a malformed/HTML 5xx response doesn't fill logs.
		let bodyText = "";
		try {
			bodyText = (await response.text()).slice(0, 1024);
		} catch {
			// ignore secondary read failure
		}
		logger.warn?.(
			{
				event: "cdn_purge_http_error",
				status: response.status,
				body: bodyText,
			},
			"Cloudflare purge returned non-2xx",
		);
		return { ok: false, reason: `http_${response.status}` };
	}

	// Cloudflare returns 200 with `{success: false, errors: [...]}` on
	// permission/scope problems — surface those as warnings even though
	// the HTTP status was OK.
	let envelope: CloudflareResponseEnvelope | undefined;
	try {
		envelope = (await response.json()) as CloudflareResponseEnvelope;
	} catch {
		// JSON parse failure on a 2xx is unusual but not fatal — count as success
		// since the cache may have actually been purged.
		return { ok: true };
	}

	if (envelope && envelope.success === false) {
		logger.warn?.(
			{
				event: "cdn_purge_api_error",
				errors: envelope.errors ?? [],
			},
			"Cloudflare purge returned success=false",
		);
		return { ok: false, reason: "cloudflare_api_error" };
	}

	return { ok: true };
}

export function createCdnPurgeClient(
	config: CdnPurgeConfig,
	logger: CdnLogger,
): CdnPurgeClient {
	const { enabled, zoneId, apiToken, baseUrl } = config;

	if (!enabled) {
		return noopClient(logger, "disabled_by_config");
	}
	if (!zoneId || !apiToken || !baseUrl) {
		// Belt-and-braces: `loadConfig` already throws when
		// CLOUDFLARE_PURGE_ENABLED=true but credentials are missing.
		// This branch covers the unlikely case where someone constructs
		// the client directly (e.g. a test harness) without going through
		// envSchema validation.
		return noopClient(logger, "missing_credentials");
	}

	const endpoint = PURGE_ENDPOINT(zoneId);
	logger.info?.(
		{ event: "cdn_purge_client_ready", zoneId },
		"Cloudflare CDN purge client initialized",
	);

	return {
		enabled: true,
		async purgeUrls(urls: string[]): Promise<void> {
			if (urls.length === 0) {
				return;
			}
			// Strip query strings and de-dup before counting against the
			// 30/req limit. Submitting `/x?utm=a` and `/x?utm=b` as two
			// entries would waste two purge slots and still result in a
			// single hit due to "ignore query string" cache key (§3.1).
			const cleaned = Array.from(new Set(urls.map(stripQueryString)));
			const failures: string[] = [];
			for (const batch of chunk(cleaned, MAX_URLS_PER_REQUEST)) {
				const result = await postPurge(
					endpoint,
					apiToken,
					{ files: batch },
					logger,
				);
				if (!result.ok) {
					failures.push(result.reason);
				}
			}
			if (failures.length > 0) {
				// Surface aggregated failure so the BullMQ worker sees the
				// rejection and triggers retry / DLQ. The fail-soft contract
				// lives in `enqueueCdnPurge`, NOT inside this client — once
				// the job is on the queue, retries are the recovery path.
				throw new CdnPurgeError(
					`CDN purge failed for ${failures.length}/${
						Math.ceil(cleaned.length / MAX_URLS_PER_REQUEST)
					} chunks: ${failures.join(", ")}`,
					failures,
				);
			}
		},
		async purgeTags(tags: string[]): Promise<void> {
			if (tags.length === 0) {
				return;
			}
			const cleaned = Array.from(new Set(tags));
			const failures: string[] = [];
			for (const batch of chunk(cleaned, MAX_URLS_PER_REQUEST)) {
				const result = await postPurge(
					endpoint,
					apiToken,
					{ tags: batch },
					logger,
				);
				if (!result.ok) {
					failures.push(result.reason);
				}
			}
			if (failures.length > 0) {
				throw new CdnPurgeError(
					`CDN purge failed for ${failures.length}/${
						Math.ceil(cleaned.length / MAX_URLS_PER_REQUEST)
					} tag chunks: ${failures.join(", ")}`,
					failures,
				);
			}
		},
	};
}
