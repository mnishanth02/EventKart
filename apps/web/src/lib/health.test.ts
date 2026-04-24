// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock server env (required by api-client.server import chain) ───
vi.mock("#/lib/env/server", () => ({
	get serverEnv() {
		return {
			INTERNAL_API_URL: "http://internal-api.test:3001",
			INTERNAL_API_KEY: "test-key",
			SERVER_URL: undefined,
		};
	},
}));

// ── Mock serverApiClient ───────────────────────────────────────────
const mockServerApiClient = vi.fn();

vi.mock("#/lib/api-client.server", () => ({
	serverApiClient: (...args: unknown[]) => mockServerApiClient(...args),
}));

// ── Tests ──────────────────────────────────────────────────────────

describe("checkApiReachability", () => {
	beforeEach(() => {
		mockServerApiClient.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns ok when the API responds successfully", async () => {
		mockServerApiClient.mockResolvedValueOnce({ status: "ok" });

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.name).toBe("api");
		expect(result.status).toBe("ok");
		expect(result.latency_ms).toBeGreaterThanOrEqual(0);
		expect(result).not.toHaveProperty("message");
	});

	it("calls serverApiClient with /ready and a timeout signal", async () => {
		mockServerApiClient.mockResolvedValueOnce({ status: "ok" });

		const { checkApiReachability } = await import("#/lib/health");
		await checkApiReachability();

		expect(mockServerApiClient).toHaveBeenCalledOnce();
		const [path, options] = mockServerApiClient.mock.calls[0] as [
			string,
			{ signal: AbortSignal },
		];
		expect(path).toBe("/ready");
		expect(options.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns error when serverApiClient throws", async () => {
		mockServerApiClient.mockRejectedValueOnce(new Error("Connection refused"));

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.name).toBe("api");
		expect(result.status).toBe("error");
		expect(result.latency_ms).toBeGreaterThanOrEqual(0);
		expect(result.message).toBe("API unreachable");
	});

	it("returns error when serverApiClient throws a non-Error", async () => {
		mockServerApiClient.mockRejectedValueOnce("network failure");

		const { checkApiReachability } = await import("#/lib/health");
		const result = await checkApiReachability();

		expect(result.status).toBe("error");
		expect(result.message).toBe("API unreachable");
	});
});
