import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod/v4";
import { singleFlight } from "../../lib/cache-stampede.js";
import { buildSitemapXml } from "./service.js";

/**
 * I-2.4.4 — public sitemap endpoint.
 *
 * Routing:
 *   `GET /api/v1/sitemap.xml` — internal canonical path.
 *   Cloudflare maps `eventkart.in/sitemap.xml` to this endpoint via an
 *   Origin Rule (see docs/operations/cloudflare-cdn-setup.md §3.7).
 *
 * Caching layers (defence in depth):
 *   1. **Cloudflare edge** — `Cache-Control: max-age=3600,
 *      stale-while-revalidate=86400`. Configured in
 *      cloudflare-cdn-setup.md §3.3.
 *   2. **Origin Redis cache** — `cache:sitemap:current`, TTL 25h. The
 *      nightly BullMQ regen job (see queues/sitemap-regen.ts) refreshes
 *      this on a 24h cadence; the 25h TTL gives a 1h safety margin so
 *      a delayed worker run never produces a cache miss visible to
 *      crawlers.
 *   3. **Single-flight** — protects the cache miss path against
 *      thundering herds. Producer runs at most once per
 *      `lockTimeoutMs` even under concurrent crawler hits.
 *
 * The route is intentionally **public** (no `requireInternal`,
 * `requireAuth`, or `requireRole`). Search-engine crawlers must be
 * able to fetch it anonymously.
 */

const SITEMAP_CACHE_KEY = "sitemap:current";
const SITEMAP_CACHE_TTL_SEC = 25 * 60 * 60; // 25h
const SITEMAP_CACHE_CONTROL =
	"public, max-age=3600, stale-while-revalidate=86400";
const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";
const sitemapXmlResponseSchema = z
	.string()
	.meta({ contentMediaType: SITEMAP_CONTENT_TYPE });

const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.get(
		"/sitemap.xml",
		{
			schema: {
				response: {
					200: sitemapXmlResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const cdnBaseUrl = app.config.CDN_BASE_URL;

			const xml = await singleFlight<string>(
				app.redis.cache,
				SITEMAP_CACHE_KEY,
				SITEMAP_CACHE_TTL_SEC,
				() =>
					buildSitemapXml({
						db: app.db,
						log: request.log,
						...(cdnBaseUrl !== undefined ? { cdnBaseUrl } : {}),
					}),
				// Sitemap regen on miss can do non-trivial DB work (events
				// scan + organizers scan). Hold the lock long enough for a
				// large dataset; followers fail-OPEN after 5s rather than
				// stall a crawler request.
				{ lockTtlMs: 30_000, lockTimeoutMs: 5_000 },
			);

			reply.header("content-type", SITEMAP_CONTENT_TYPE);
			reply.header("cache-control", SITEMAP_CACHE_CONTROL);
			return reply.send(xml);
		},
	);
};

export default sitemapRoutes;

// Re-export constants so worker code (queues/sitemap-regen.ts) can
// SETEX the same key with the same TTL — keeping the contract in one
// place avoids drift between writer and reader.
export {
	SITEMAP_CACHE_CONTROL,
	SITEMAP_CACHE_KEY,
	SITEMAP_CACHE_TTL_SEC,
	SITEMAP_CONTENT_TYPE,
};
