// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock server env ────────────────────────────────────────────────
vi.mock("#/lib/env/server", () => ({
	get serverEnv() {
		return {
			INTERNAL_API_URL: "http://internal-api.test:3001",
			INTERNAL_API_KEY: "test-key",
			SERVER_URL: undefined,
		};
	},
}));

// ── Mock global fetch ──────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Tests ──────────────────────────────────────────────────────────

describe("checkApiReachability", () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns ok when the API responds successfully", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
		);

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.name).toBe("api");
		expect(result.status).toBe("ok");
		expect(result.latency_ms).toBeGreaterThanOrEqual(0);
		expect(result).not.toHaveProperty("message");
	});

	it("calls fetch with the correct /ready URL and a timeout signal", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
		);

		const { checkApiReachability } = await import("#/lib/health");
		await checkApiReachability();

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, options] = mockFetch.mock.calls[0] as [
			string,
			{ signal: AbortSignal },
		];
		expect(url).toBe("http://internal-api.test:3001/ready");
		expect(options.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns error when fetch throws", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.name).toBe("api");
		expect(result.status).toBe("error");
		expect(result.latency_ms).toBeGreaterThanOrEqual(0);
		expect(result.message).toBe("API unreachable");
	});

	it("returns error when fetch returns a non-ok response", async () => {
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.status).toBe("error");
		expect(result.message).toBe("API unreachable");
	});
});
