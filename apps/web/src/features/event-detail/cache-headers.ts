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
