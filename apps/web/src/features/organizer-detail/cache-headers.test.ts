import { describe, expect, it, vi } from "vitest";

import {
	ORGANIZER_DETAIL_CACHE_CONTROL,
	setOrganizerDetailCacheHeaders,
} from "./cache-headers";

/**
 * I-2.4.1 cache contract regression test for `/organizers/:slug`.
 *
 * Mirrors the event-detail cache-headers test. The two SSR routes MUST
 * ship the same `Cache-Control` directive and MUST NOT set
 * `Vary: Cookie` so the Cloudflare zone configuration in
 * `docs/operations/cloudflare-cdn-setup.md` can use a single matching
 * cache rule for both `/events/*` and `/organizers/*`.
 */
describe("ORGANIZER_DETAIL_CACHE_CONTROL (I-2.4.1 cache contract)", () => {
	it("matches the exact contract advertised to Cloudflare", () => {
		expect(ORGANIZER_DETAIL_CACHE_CONTROL).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
	});

	it("must not include 'private' or 'no-store' (would defeat the edge cache)", () => {
		expect(ORGANIZER_DETAIL_CACHE_CONTROL).not.toMatch(/private/i);
		expect(ORGANIZER_DETAIL_CACHE_CONTROL).not.toMatch(/no-store/i);
	});
});

describe("setOrganizerDetailCacheHeaders", () => {
	it("forwards the supplied Headers verbatim with no Vary: Cookie injection", async () => {
		const headers = new Headers({
			"Cache-Control": ORGANIZER_DETAIL_CACHE_CONTROL,
		});

		await expect(
			setOrganizerDetailCacheHeaders(headers),
		).resolves.not.toThrow();

		expect(headers.get("Cache-Control")).toBe(ORGANIZER_DETAIL_CACHE_CONTROL);
		expect(headers.has("Vary")).toBe(false);
	});

	it("can be invoked through a plain function reference (callable contract)", () => {
		const fn = vi.fn(setOrganizerDetailCacheHeaders);
		fn(new Headers());
		expect(fn).toHaveBeenCalledOnce();
	});
});
