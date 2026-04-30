import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/lib/config.js";

const originalInternalApiKey = process.env.INTERNAL_API_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalCloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID;
const originalCloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;
const originalCloudflarePurgeEnabled = process.env.CLOUDFLARE_PURGE_ENABLED;
const originalCdnBaseUrl = process.env.CDN_BASE_URL;

const VALID_DATABASE_URL =
	"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev";

function restoreEnvValue(key: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

describe("loadConfig", () => {
	afterEach(() => {
		restoreEnvValue("INTERNAL_API_KEY", originalInternalApiKey);
		restoreEnvValue("DATABASE_URL", originalDatabaseUrl);
		restoreEnvValue("CLOUDFLARE_ZONE_ID", originalCloudflareZoneId);
		restoreEnvValue("CLOUDFLARE_API_TOKEN", originalCloudflareApiToken);
		restoreEnvValue(
			"CLOUDFLARE_PURGE_ENABLED",
			originalCloudflarePurgeEnabled,
		);
		restoreEnvValue("CDN_BASE_URL", originalCdnBaseUrl);
	});

	it("loadConfig strips INTERNAL_API_KEY when explicitly set to empty string, even if process.env provides a value", () => {
		process.env.INTERNAL_API_KEY = "real-key";
		process.env.DATABASE_URL = VALID_DATABASE_URL;

		const config = loadConfig({ INTERNAL_API_KEY: "" });

		expect(config.INTERNAL_API_KEY).toBeUndefined();
		expect("INTERNAL_API_KEY" in config).toBe(false);
	});

	describe("Cloudflare CDN settings (I-2.4.1)", () => {
		it("defaults all Cloudflare fields to disabled / undefined when nothing is provided", () => {
			delete process.env.CLOUDFLARE_ZONE_ID;
			delete process.env.CLOUDFLARE_API_TOKEN;
			delete process.env.CLOUDFLARE_PURGE_ENABLED;
			delete process.env.CDN_BASE_URL;
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			const config = loadConfig({});

			expect(config.CLOUDFLARE_ZONE_ID).toBeUndefined();
			expect(config.CLOUDFLARE_API_TOKEN).toBeUndefined();
			expect(config.CLOUDFLARE_PURGE_ENABLED).toBe(false);
			expect(config.CDN_BASE_URL).toBeUndefined();
		});

		it("strips empty-string Cloudflare values like every other optional field", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			const config = loadConfig({
				CLOUDFLARE_ZONE_ID: "",
				CLOUDFLARE_API_TOKEN: "",
				CDN_BASE_URL: "",
			});

			expect("CLOUDFLARE_ZONE_ID" in config).toBe(false);
			expect("CLOUDFLARE_API_TOKEN" in config).toBe(false);
			expect("CDN_BASE_URL" in config).toBe(false);
		});

		it("normalizes CDN_BASE_URL to its origin (no trailing slash, no path)", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			const config = loadConfig({
				CDN_BASE_URL: "https://eventkart.in/",
			});

			expect(config.CDN_BASE_URL).toBe("https://eventkart.in");
		});

		it("rejects CDN_BASE_URL when it carries a path, query, or hash", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			expect(() =>
				loadConfig({
					CDN_BASE_URL: "https://eventkart.in/events",
				}),
			).toThrow(/CDN_BASE_URL must be an absolute origin/);
		});

		it("accepts CLOUDFLARE_PURGE_ENABLED=true when token + zone are also set", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			const config = loadConfig({
				CLOUDFLARE_ZONE_ID: "zone-123",
				CLOUDFLARE_API_TOKEN: "token-abc",
				CLOUDFLARE_PURGE_ENABLED: true,
			});

			expect(config.CLOUDFLARE_PURGE_ENABLED).toBe(true);
			expect(config.CLOUDFLARE_ZONE_ID).toBe("zone-123");
			expect(config.CLOUDFLARE_API_TOKEN).toBe("token-abc");
		});

		it("rejects CLOUDFLARE_PURGE_ENABLED=true when CLOUDFLARE_API_TOKEN is missing (fail-closed)", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			expect(() =>
				loadConfig({
					CLOUDFLARE_ZONE_ID: "zone-123",
					CLOUDFLARE_PURGE_ENABLED: true,
				}),
			).toThrow(
				/CLOUDFLARE_PURGE_ENABLED is true but CLOUDFLARE_ZONE_ID and\/or CLOUDFLARE_API_TOKEN are not set/,
			);
		});

		it("rejects CLOUDFLARE_PURGE_ENABLED=true when CLOUDFLARE_ZONE_ID is missing (fail-closed)", () => {
			process.env.DATABASE_URL = VALID_DATABASE_URL;

			expect(() =>
				loadConfig({
					CLOUDFLARE_API_TOKEN: "token-abc",
					CLOUDFLARE_PURGE_ENABLED: true,
				}),
			).toThrow(
				/CLOUDFLARE_PURGE_ENABLED is true but CLOUDFLARE_ZONE_ID and\/or CLOUDFLARE_API_TOKEN are not set/,
			);
		});
	});
});

