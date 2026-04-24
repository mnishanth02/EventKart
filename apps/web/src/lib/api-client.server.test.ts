// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "#/lib/api-client.shared";

// ── Mutable env used by the mock ───────────────────────────────────
let mockServerEnv = {
	INTERNAL_API_URL: "http://internal-api.test:3001" as string | undefined,
	INTERNAL_API_KEY: "test-internal-key-123" as string | undefined,
	SERVER_URL: undefined as string | undefined,
};

vi.mock("#/lib/env/server", () => ({
	get serverEnv() {
		return mockServerEnv;
	},
}));

// ── Helpers ────────────────────────────────────────────────────────

function createMockResponse(
	body: unknown,
	init: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
): Response {
	const { status = 200, statusText = "OK", headers = {} } = init;
	const responseHeaders = new Headers(headers);
	if (!responseHeaders.has("content-type")) {
		responseHeaders.set("content-type", "application/json");
	}
	return new Response(body !== undefined ? JSON.stringify(body) : null, {
		status,
		statusText,
		headers: responseHeaders,
	});
}

// ── Tests ──────────────────────────────────────────────────────────

describe("serverApiClient (with INTERNAL_API_KEY)", () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockServerEnv = {
			INTERNAL_API_URL: "http://internal-api.test:3001",
			INTERNAL_API_KEY: "test-internal-key-123",
			SERVER_URL: undefined,
		};
		mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GET request uses INTERNAL_API_URL as base", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ events: [] }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/events");

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://internal-api.test:3001/api/v1/events");
	});

	it("attaches X-Internal-Key header when configured", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/health");

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(headers["X-Internal-Key"]).toBe("test-internal-key-123");
	});

	it("sends POST with JSON body and Content-Type header", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ id: "evt_1" }, { status: 201 }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/events", {
			method: "POST",
			body: { title: "Test Event" },
		});

		const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://internal-api.test:3001/api/v1/events");
		expect(init.method).toBe("POST");
		expect(init.body).toBe(JSON.stringify({ title: "Test Event" }));
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("does not attach a CSRF token (server-side requests)", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/events", { method: "POST", body: {} });

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(headers).not.toHaveProperty("X-CSRF-Token");
		expect(headers).not.toHaveProperty("x-csrf-token");
	});

	it("does not set credentials: 'include'", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/events");

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(init).not.toHaveProperty("credentials");
	});

	it("forwards custom headers (cookie forwarding foundation)", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ me: "user" }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/auth/me", {
			headers: { Cookie: "session=abc123" },
		});

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(headers.Cookie).toBe("session=abc123");
		// Verify default Accept header is still present
		expect(headers.Accept).toBe("application/json");
	});

	it("throws ApiClientError on non-2xx response", async () => {
		const errorBody = {
			success: false,
			error: {
				code: "NOT_FOUND",
				message: "Event not found",
				details: { eventId: "evt_missing" },
			},
		};
		mockFetch.mockResolvedValueOnce(
			createMockResponse(errorBody, { status: 404, statusText: "Not Found" }),
		);

		const { serverApiClient } = await import("#/lib/api-client.server");
		const err = await serverApiClient("/events/evt_missing").catch((e: unknown) => e);

		expect(err).toBeInstanceOf(ApiClientError);
		const apiErr = err as InstanceType<typeof ApiClientError>;
		expect(apiErr.status).toBe(404);
		expect(apiErr.code).toBe("NOT_FOUND");
		expect(apiErr.message).toBe("Event not found");
		expect(apiErr.details).toEqual({ eventId: "evt_missing" });
	});

	it("returns undefined for 204 No Content response", async () => {
		const emptyResponse = new Response(null, {
			status: 204,
			statusText: "No Content",
		});
		mockFetch.mockResolvedValueOnce(emptyResponse);

		const { serverApiClient } = await import("#/lib/api-client.server");
		const result = await serverApiClient("/events/evt_1/archive");

		expect(result).toBeUndefined();
	});
});

describe("serverApiClient (without INTERNAL_API_KEY)", () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockServerEnv = {
			INTERNAL_API_URL: undefined,
			INTERNAL_API_KEY: undefined,
			SERVER_URL: undefined,
		};
		mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("omits X-Internal-Key header when INTERNAL_API_KEY is not set", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/health");

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(headers).not.toHaveProperty("X-Internal-Key");
	});

	it("falls back to localhost:3001 when INTERNAL_API_URL is not set", async () => {
		mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

		const { serverApiClient } = await import("#/lib/api-client.server");
		await serverApiClient("/health");

		const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://localhost:3001/api/v1/health");
	});
});
