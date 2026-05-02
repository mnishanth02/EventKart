import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import {
	createWorkerCdnPurgeConfig,
	isWorkerDirectRun,
} from "../../src/workers/index.js";

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

describe("isWorkerDirectRun", () => {
	it("returns true when argv1 (.ts) matches import.meta.url", () => {
		const argv1 = "/repo/apps/api/src/workers/index.ts";
		const importMetaUrl = pathToFileURL(argv1).href;

		expect(isWorkerDirectRun(argv1, importMetaUrl)).toBe(true);
	});

	it("returns true when argv1 (.js) matches import.meta.url", () => {
		const argv1 = "/repo/apps/api/dist/workers/index.js";
		const importMetaUrl = pathToFileURL(argv1).href;

		expect(isWorkerDirectRun(argv1, importMetaUrl)).toBe(true);
	});

	it("returns false when argv1 does not match import.meta.url", () => {
		const argv1 = "/repo/apps/api/src/server.ts";
		const importMetaUrl = pathToFileURL(
			"/repo/apps/api/src/workers/index.ts",
		).href;

		expect(isWorkerDirectRun(argv1, importMetaUrl)).toBe(false);
	});

	it("returns false when argv1 is undefined", () => {
		const importMetaUrl = pathToFileURL(
			"/repo/apps/api/src/workers/index.ts",
		).href;

		expect(isWorkerDirectRun(undefined, importMetaUrl)).toBe(false);
	});
});
