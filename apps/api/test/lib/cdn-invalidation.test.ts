import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type CdnPurgeConfig,
	createCdnPurgeClient,
	eventCacheUrls,
	MAX_URLS_PER_REQUEST,
	organizerCacheUrls,
	sitemapCacheUrls,
	stripQueryString,
} from "../../src/lib/cdn-invalidation.js";

// Minimal fixture used by all `enabled: true` tests. Values are
// intentionally synthetic — the test must NEVER hit api.cloudflare.com.
const ENABLED_CONFIG: CdnPurgeConfig = {
	enabled: true,
	zoneId: "zone-test-fixture",
	apiToken: "token-NEVER-real-cf-token",
	baseUrl: "https://eventkart.example",
};

interface LogEntry {
	level: "debug" | "info" | "warn" | "error";
	obj: unknown;
	msg: string | undefined;
}

function makeLogger() {
	const entries: LogEntry[] = [];
	const make =
		(level: LogEntry["level"]) =>
		(obj: unknown, msg?: string): void => {
			entries.push({ level, obj, msg });
		};
	return {
		entries,
		debug: make("debug"),
		info: make("info"),
		warn: make("warn"),
		error: make("error"),
	};
}

/** Helper: assert no log entry contains the API token in any string field. */
function expectNoTokenLeak(entries: LogEntry[], token: string): void {
	const serialized = JSON.stringify(entries);
	expect(serialized).not.toContain(token);
}

describe("stripQueryString (I-2.4.2)", () => {
	it("removes query string", () => {
		expect(stripQueryString("https://x.test/a?utm_source=x")).toBe(
			"https://x.test/a",
		);
	});

	it("removes hash fragment", () => {
		expect(stripQueryString("https://x.test/a#section")).toBe(
			"https://x.test/a",
		);
	});

	it("removes both query string and hash", () => {
		expect(stripQueryString("https://x.test/a?b=1#section")).toBe(
			"https://x.test/a",
		);
	});

	it("returns URL unchanged when no query/hash present", () => {
		expect(stripQueryString("https://x.test/a")).toBe("https://x.test/a");
	});

	it("falls back to manual parse for malformed input", () => {
		// Doesn't throw; returns the path-ish portion.
		expect(stripQueryString("not-a-url?x=1#y")).toBe("not-a-url");
	});
});

describe("URL helpers (I-2.4.2)", () => {
	it("eventCacheUrls produces /events/<slug>", () => {
		expect(eventCacheUrls("https://eventkart.example", "trail-run")).toEqual([
			"https://eventkart.example/events/trail-run",
		]);
	});

	it("eventCacheUrls trims trailing slashes from the base URL", () => {
		expect(eventCacheUrls("https://eventkart.example///", "x")).toEqual([
			"https://eventkart.example/events/x",
		]);
	});

	it("eventCacheUrls URL-encodes the slug", () => {
		expect(eventCacheUrls("https://eventkart.example", "a/b spaces")).toEqual([
			"https://eventkart.example/events/a%2Fb%20spaces",
		]);
	});

	it("organizerCacheUrls produces /organizers/<slug>", () => {
		expect(
			organizerCacheUrls("https://eventkart.example", "acme-events"),
		).toEqual(["https://eventkart.example/organizers/acme-events"]);
	});

	it("sitemapCacheUrls produces /sitemap.xml", () => {
		expect(sitemapCacheUrls("https://eventkart.example")).toEqual([
			"https://eventkart.example/sitemap.xml",
		]);
	});
});

describe("createCdnPurgeClient — disabled paths", () => {
	it("returns no-op stub when enabled=false; never calls fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const log = makeLogger();
		const client = createCdnPurgeClient({ ...ENABLED_CONFIG, enabled: false }, log);

		expect(client.enabled).toBe(false);
		await client.purgeUrls(["https://eventkart.example/events/x"]);
		await client.purgeTags(["tag1"]);

		expect(fetchSpy).not.toHaveBeenCalled();
		// Each call emits a debug skip line.
		expect(log.entries.filter((e) => e.level === "debug")).toHaveLength(2);
		expectNoTokenLeak(log.entries, ENABLED_CONFIG.apiToken!);
	});

	it("returns no-op stub when zoneId is missing", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const log = makeLogger();
		const client = createCdnPurgeClient(
			{ ...ENABLED_CONFIG, zoneId: undefined },
			log,
		);

		expect(client.enabled).toBe(false);
		await client.purgeUrls(["https://x.test/y"]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns no-op stub when apiToken is missing", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const log = makeLogger();
		const client = createCdnPurgeClient(
			{ ...ENABLED_CONFIG, apiToken: undefined },
			log,
		);

		expect(client.enabled).toBe(false);
		await client.purgeUrls(["https://x.test/y"]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns no-op stub when baseUrl is missing", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const log = makeLogger();
		const client = createCdnPurgeClient(
			{ ...ENABLED_CONFIG, baseUrl: undefined },
			log,
		);

		expect(client.enabled).toBe(false);
		await client.purgeUrls(["https://x.test/y"]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe("createCdnPurgeClient — enabled paths", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	function okResponse(): Response {
		return new Response(JSON.stringify({ success: true, errors: [] }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	it("posts to the zone purge endpoint with bearer auth and JSON body", async () => {
		fetchSpy.mockResolvedValue(okResponse());
		const log = makeLogger();
		const client = createCdnPurgeClient(ENABLED_CONFIG, log);

		await client.purgeUrls(["https://eventkart.example/events/x"]);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [endpoint, init] = fetchSpy.mock.calls[0]!;
		expect(endpoint).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-test-fixture/purge_cache",
		);
		expect(init?.method).toBe("POST");

		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe(
			`Bearer ${ENABLED_CONFIG.apiToken}`,
		);
		expect(headers["Content-Type"]).toBe("application/json");

		expect(JSON.parse(init?.body as string)).toEqual({
			files: ["https://eventkart.example/events/x"],
		});

		// Token must NEVER show up in any logged line.
		expectNoTokenLeak(log.entries, ENABLED_CONFIG.apiToken!);
	});

	it("strips query strings before submitting", async () => {
		fetchSpy.mockResolvedValue(okResponse());
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());

		await client.purgeUrls([
			"https://eventkart.example/events/x?utm_source=email",
			"https://eventkart.example/events/y#anchor",
		]);

		const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
		expect(body.files).toEqual([
			"https://eventkart.example/events/x",
			"https://eventkart.example/events/y",
		]);
	});

	it("dedupes URLs after stripping query strings", async () => {
		fetchSpy.mockResolvedValue(okResponse());
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());

		await client.purgeUrls([
			"https://eventkart.example/events/x?utm_source=a",
			"https://eventkart.example/events/x?utm_source=b",
			"https://eventkart.example/events/x",
		]);

		const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
		expect(body.files).toEqual(["https://eventkart.example/events/x"]);
	});

	it("chunks payloads larger than MAX_URLS_PER_REQUEST", async () => {
		fetchSpy.mockResolvedValue(okResponse());
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());

		const urls = Array.from(
			{ length: 35 },
			(_, i) => `https://eventkart.example/events/e${i}`,
		);
		await client.purgeUrls(urls);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		const firstBody = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
		const secondBody = JSON.parse(fetchSpy.mock.calls[1]![1]?.body as string);
		expect(firstBody.files).toHaveLength(MAX_URLS_PER_REQUEST);
		expect(secondBody.files).toHaveLength(35 - MAX_URLS_PER_REQUEST);
	});

	it("no-ops when given an empty url array", async () => {
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());
		await client.purgeUrls([]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("no-ops when given an empty tag array", async () => {
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());
		await client.purgeTags([]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("logs and THROWS on network errors so worker retries", async () => {
		fetchSpy.mockRejectedValue(new Error("ECONNRESET"));
		const log = makeLogger();
		const client = createCdnPurgeClient(ENABLED_CONFIG, log);

		await expect(
			client.purgeUrls(["https://eventkart.example/events/x"]),
		).rejects.toThrow(/CDN purge failed/);

		const warns = log.entries.filter((e) => e.level === "warn");
		expect(warns.length).toBeGreaterThanOrEqual(1);
		expect(warns[0]!.obj).toMatchObject({ event: "cdn_purge_network_error" });
		expectNoTokenLeak(log.entries, ENABLED_CONFIG.apiToken!);
	});

	it("logs and THROWS on non-2xx HTTP responses so worker retries", async () => {
		fetchSpy.mockResolvedValue(
			new Response("Internal Server Error", { status: 500 }),
		);
		const log = makeLogger();
		const client = createCdnPurgeClient(ENABLED_CONFIG, log);

		await expect(
			client.purgeUrls(["https://eventkart.example/events/x"]),
		).rejects.toThrow(/CDN purge failed/);

		const warns = log.entries.filter((e) => e.level === "warn");
		expect(warns[0]!.obj).toMatchObject({
			event: "cdn_purge_http_error",
			status: 500,
		});
		expectNoTokenLeak(log.entries, ENABLED_CONFIG.apiToken!);
	});

	it("logs success=false envelopes as warnings AND throws (worker retries)", async () => {
		fetchSpy.mockResolvedValue(
			new Response(
				JSON.stringify({
					success: false,
					errors: [{ code: 10000, message: "Authentication error" }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		const log = makeLogger();
		const client = createCdnPurgeClient(ENABLED_CONFIG, log);

		await expect(
			client.purgeUrls(["https://eventkart.example/events/x"]),
		).rejects.toThrow(/CDN purge failed/);

		const warns = log.entries.filter((e) => e.level === "warn");
		expect(warns[0]!.obj).toMatchObject({ event: "cdn_purge_api_error" });
	});

	it("purgeTags posts to the same endpoint with {tags: [...]} body", async () => {
		fetchSpy.mockResolvedValue(okResponse());
		const client = createCdnPurgeClient(ENABLED_CONFIG, makeLogger());

		await client.purgeTags(["tag-a", "tag-b"]);

		const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
		expect(body).toEqual({ tags: ["tag-a", "tag-b"] });
	});

	it("logs an init line containing zoneId but NEVER the apiToken", () => {
		const log = makeLogger();
		createCdnPurgeClient(ENABLED_CONFIG, log);

		const infos = log.entries.filter((e) => e.level === "info");
		expect(infos[0]!.obj).toMatchObject({
			event: "cdn_purge_client_ready",
			zoneId: ENABLED_CONFIG.zoneId,
		});
		expectNoTokenLeak(log.entries, ENABLED_CONFIG.apiToken!);
	});
});
