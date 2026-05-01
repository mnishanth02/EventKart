import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Route modules are part of the client bundle graph, so they must not import
 * `@tanstack/react-start/server` directly. This isomorphic helper keeps the
 * server-only response-header call out of the client build while preserving a
 * no-op implementation for client-side navigations.
 *
 * Mirrors `setPublicEventCacheHeaders` in `event-detail/cache-headers.ts` —
 * same shape, same dynamic import branch, same no-op client branch.
 */
export const setLegalPageCacheHeaders = createIsomorphicFn()
	.client((_headers: Headers) => undefined)
	.server(async (headers: Headers) => {
		const { setResponseHeaders } = await import("@tanstack/react-start/server");
		setResponseHeaders(headers);
	});

/**
 * Cache-Control value used by the Module 2.5 static legal/public routes
 * (`/privacy`, `/terms`, `/about`, `/faq`, `/contact`).
 *
 * Legal copy is revision-controlled in source — every change ships through
 * a deploy — so a longer freshness window is safe. The 1-hour `s-maxage`
 * paired with a 24-hour `stale-while-revalidate` lets Cloudflare serve a
 * stale page instantly on the first request after expiry, then refresh in
 * the background. Users never wait on an origin round-trip and the API
 * is never asked to render these pages on a hot cache.
 *
 * The string MUST stay a literal compile-time constant (no interpolation,
 * no env reads) so a Cloudflare cache rule can pin it byte-for-byte and
 * the cache-headers regression test can assert it as a single source of
 * truth. The companion `Vary` header is intentionally NOT set: these
 * responses are identical for all callers (anonymous SSR), and
 * `Vary: Cookie` would shred CDN hit rate by treating every distinct
 * `kiran_session` cookie value as a separate cache entry.
 */
export const LEGAL_PAGE_CACHE_CONTROL =
	"public, s-maxage=3600, stale-while-revalidate=86400";
