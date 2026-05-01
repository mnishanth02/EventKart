import { describe, expect, it } from "vitest";

import { createWorkerCdnPurgeConfig } from "../../src/workers/index.js";

describe("createWorkerCdnPurgeConfig", () => {
	it("normalizes CDN_BASE_URL to an origin when purge is enabled", () => {
		const config = createWorkerCdnPurgeConfig({
			CLOUDFLARE_ZONE_ID: "zone-123",
			CLOUDFLARE_API_TOKEN: "token-abc",
			CLOUDFLARE_PURGE_ENABLED: "true",
			CDN_BASE_URL: "https://eventkart.in/",
		});

		expect(config).toEqual({
			enabled: true,
			zoneId: "zone-123",
			apiToken: "token-abc",
			baseUrl: "https://eventkart.in",
		});
	});

	it("rejects a CDN_BASE_URL with a path when purge is enabled", () => {
		expect(() =>
			createWorkerCdnPurgeConfig({
				CLOUDFLARE_ZONE_ID: "zone-123",
				CLOUDFLARE_API_TOKEN: "token-abc",
				CLOUDFLARE_PURGE_ENABLED: "true",
				CDN_BASE_URL: "https://eventkart.in/events",
			}),
		).toThrow(
			/CDN_BASE_URL must be an absolute origin without a path, query, or hash/,
		);
	});
});
