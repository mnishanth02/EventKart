import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Sets CDN cache headers for the public organizer profile route.
 *
 * Mirrors `setPublicEventCacheHeaders` from the event-detail feature so
 * `/organizers/:slug` ships the same edge cache contract as
 * `/events/:slug`: 60-second freshness with a 5-minute SWR window.
 *
 * Route modules are part of the client bundle graph, so they must not
 * import `@tanstack/react-start/server` directly. This isomorphic helper
 * keeps the server-only response-header call out of the client build
 * while preserving a no-op implementation for client-side navigations.
 */
export const setOrganizerDetailCacheHeaders = createIsomorphicFn()
	.client((_headers: Headers) => undefined)
	.server(async (headers: Headers) => {
		const { setResponseHeaders } = await import("@tanstack/react-start/server");
		setResponseHeaders(headers);
	});

/**
 * Cache-Control value used by the organizer detail route. Exported so
 * the loader can assemble the `Headers` object in one place and tests
 * can assert the exact directive.
 */
export const ORGANIZER_DETAIL_CACHE_CONTROL =
	"public, s-maxage=60, stale-while-revalidate=300";
