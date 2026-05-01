import { describe, expect, it, vi } from "vitest";

import {
	PUBLIC_EVENT_CACHE_CONTROL,
	setPublicEventCacheHeaders,
} from "./cache-headers";

/**
 * I-2.4.1 cache contract regression test.
 *
 * The Cloudflare zone configuration documented in
 * `docs/operations/cloudflare-cdn-setup.md` is built around this exact
 * `Cache-Control` directive AND the absence of a `Vary: Cookie` header
 * on `/events/:slug`. If either drifts, edge cache hit rate collapses
 * (or, worse, authenticated cookies start fragmenting cache entries).
 * Pin both with byte-for-byte assertions.
 */
describe("PUBLIC_EVENT_CACHE_CONTROL (I-2.4.1 cache contract)", () => {
	it("matches the exact contract advertised to Cloudflare", () => {
		expect(PUBLIC_EVENT_CACHE_CONTROL).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
	});

	it("must not include 'private' or 'no-store' (would defeat the edge cache)", () => {
		expect(PUBLIC_EVENT_CACHE_CONTROL).not.toMatch(/private/i);
		expect(PUBLIC_EVENT_CACHE_CONTROL).not.toMatch(/no-store/i);
	});
});

describe("setPublicEventCacheHeaders", () => {
	it("forwards the supplied Headers verbatim with no Vary: Cookie injection", async () => {
		// The helper is an isomorphic wrapper around `setResponseHeaders` —
		// it MUST NOT mutate or augment the headers it is handed. In the
		// browser bundle it is a no-op; this test exercises the contract by
		// proving the function exists, accepts a `Headers` instance with
		// the I-2.4.1 cache contract, and does not throw.
		const headers = new Headers({
			"Cache-Control": PUBLIC_EVENT_CACHE_CONTROL,
		});

		await expect(
			Promise.resolve(setPublicEventCacheHeaders(headers)),
		).resolves.not.toThrow();

		// The Headers instance the helper receives must remain free of
		// `Vary: Cookie`. If a future refactor adds it for any reason, the
		// CDN contract documented in cloudflare-cdn-setup.md breaks.
		expect(headers.get("Cache-Control")).toBe(PUBLIC_EVENT_CACHE_CONTROL);
		expect(headers.has("Vary")).toBe(false);
	});

	it("can be invoked through a plain function reference (callable contract)", () => {
		// Loaders use `setResponseHeaders: setPublicEventCacheHeaders` as a
		// plain function reference. Guard that the import remains a
		// callable — a shape regression here would silently disable the
		// CDN cache because the loader no-ops the call.
		const fn = vi.fn(setPublicEventCacheHeaders);
		fn(new Headers());
		expect(fn).toHaveBeenCalledOnce();
	});
});
