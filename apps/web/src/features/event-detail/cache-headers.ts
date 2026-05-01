import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Route modules are part of the client bundle graph, so they must not import
 * `@tanstack/react-start/server` directly. This isomorphic helper keeps the
 * server-only response-header call out of the client build while preserving a
 * no-op implementation for client-side navigations.
 */
export const setPublicEventCacheHeaders = createIsomorphicFn()
	.client((_headers: Headers) => undefined)
	.server(async (headers: Headers) => {
		const { setResponseHeaders } = await import("@tanstack/react-start/server");
		setResponseHeaders(headers);
	});

/**
 * Cache-Control value used by the public event detail route — the I-2.4.1
 * cache contract. Mirrors `ORGANIZER_DETAIL_CACHE_CONTROL` so both SSR
 * routes ship the same edge cache contract: 60-second freshness with a
 * 5-minute stale-while-revalidate window.
 *
 * The string MUST stay a literal compile-time constant (no interpolation,
 * no env reads) so a Cloudflare cache rule can match it byte-for-byte if
 * ever needed, and the cache-headers regression test can pin it as a
 * single source of truth. The companion `Vary` header is intentionally
 * NOT set: this response is identical for all callers (anonymous SSR),
 * and `Vary: Cookie` would shred CDN hit rate by treating every distinct
 * `kiran_session` cookie value as a separate cache entry.
 */
export const PUBLIC_EVENT_CACHE_CONTROL =
	"public, s-maxage=60, stale-while-revalidate=300";
