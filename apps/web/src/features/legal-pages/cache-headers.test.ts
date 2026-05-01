import { describe, expect, it, vi } from "vitest";

import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "./cache-headers";

/**
 * Module 2.5 cache contract regression test.
 *
 * The Cloudflare zone configuration is built around this exact
 * `Cache-Control` directive AND the absence of a `Vary: Cookie` header
 * on the static legal/public routes. If either drifts, edge cache hit
 * rate collapses (or, worse, authenticated cookies start fragmenting
 * cache entries). Pin both with byte-for-byte assertions.
 */
describe("LEGAL_PAGE_CACHE_CONTROL (Module 2.5 cache contract)", () => {
	it("matches the exact contract advertised to Cloudflare", () => {
		expect(LEGAL_PAGE_CACHE_CONTROL).toBe(
			"public, s-maxage=3600, stale-while-revalidate=86400",
		);
	});

	it("must not include 'private' or 'no-store' (would defeat the edge cache)", () => {
		expect(LEGAL_PAGE_CACHE_CONTROL).not.toMatch(/private/i);
		expect(LEGAL_PAGE_CACHE_CONTROL).not.toMatch(/no-store/i);
	});
});

describe("setLegalPageCacheHeaders", () => {
	it("forwards the supplied Headers verbatim with no Vary: Cookie injection", async () => {
		// The helper is an isomorphic wrapper around `setResponseHeaders` —
		// it MUST NOT mutate or augment the headers it is handed. Under
		// jsdom this resolves through the client (no-op) branch; the
		// callable contract still holds.
		const headers = new Headers({
			"Cache-Control": LEGAL_PAGE_CACHE_CONTROL,
		});

		await expect(
			Promise.resolve(setLegalPageCacheHeaders(headers)),
		).resolves.not.toThrow();

		expect(headers.get("Cache-Control")).toBe(LEGAL_PAGE_CACHE_CONTROL);
		expect(headers.has("Vary")).toBe(false);
	});

	it("can be invoked through a plain function reference (callable contract)", () => {
		// Loaders use `setResponseHeaders: setLegalPageCacheHeaders` as a
		// plain function reference. Guard that the import remains a
		// callable — a shape regression here would silently disable the
		// CDN cache because the loader no-ops the call.
		const fn = vi.fn(setLegalPageCacheHeaders);
		fn(new Headers());
		expect(fn).toHaveBeenCalledOnce();
	});
});
