// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "#/lib/api-client.shared";

// ── Mocks ──────────────────────────────────────────────────────────

// Track what getRequestHeader returns per header name
const mockHeaders = new Map<string, string>();

vi.mock("@tanstack/react-start/server", () => ({
	getRequestHeader: (name: string) => mockHeaders.get(name),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: (_opts: unknown) => ({
		handler: <T>(fn: () => T) => fn,
	}),
}));

vi.mock("#/lib/api-client.server", () => ({
	serverApiClient: vi.fn(),
	ApiClientError,
}));

// ── Test Setup ─────────────────────────────────────────────────────

beforeEach(() => {
	mockHeaders.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── getForwardedAuthHeaders ────────────────────────────────────────

describe("getForwardedAuthHeaders", () => {
	it("filters only kiran_session from a multi-cookie header", async () => {
		mockHeaders.set(
			"cookie",
			"theme=dark; kiran_session=abc123; _ga=GA1.2.xxx",
		);

		const { getForwardedAuthHeaders } = await import(
			"#/lib/auth/server-fns.server"
		);
		const headers = getForwardedAuthHeaders();

		expect(headers.Cookie).toBe("kiran_session=abc123");
		// Must NOT contain the other cookies
		expect(headers.Cookie).not.toContain("theme");
		expect(headers.Cookie).not.toContain("_ga");
	});

	it("forwards x-request-id when present", async () => {
		mockHeaders.set("cookie", "kiran_session=sess_xyz");
		mockHeaders.set("x-request-id", "req-12345");

		const { getForwardedAuthHeaders } = await import(
			"#/lib/auth/server-fns.server"
		);
		const headers = getForwardedAuthHeaders();

		expect(headers["X-Request-ID"]).toBe("req-12345");
		expect(headers.Cookie).toBe("kiran_session=sess_xyz");
	});

	it("returns empty object when no session cookie exists", async () => {
		mockHeaders.set("cookie", "theme=dark; _ga=GA1.2.xxx");

		const { getForwardedAuthHeaders } = await import(
			"#/lib/auth/server-fns.server"
		);
		const headers = getForwardedAuthHeaders();

		expect(headers).not.toHaveProperty("Cookie");
		expect(Object.keys(headers)).toHaveLength(0);
	});

	it("handles missing cookie header gracefully", async () => {
		// No headers set at all

		const { getForwardedAuthHeaders } = await import(
			"#/lib/auth/server-fns.server"
		);
		const headers = getForwardedAuthHeaders();

		expect(headers).toEqual({});
	});

	it("extracts cookie value that contains '=' characters", async () => {
		mockHeaders.set("cookie", "kiran_session=abc=def=ghi; other=val");

		const { getForwardedAuthHeaders } = await import(
			"#/lib/auth/server-fns.server"
		);
		const headers = getForwardedAuthHeaders();

		expect(headers.Cookie).toBe("kiran_session=abc=def=ghi");
	});
});

// ── getCurrentUser ─────────────────────────────────────────────────

describe("getCurrentUser", () => {
	it("returns session data on 200 response", async () => {
		mockHeaders.set("cookie", "kiran_session=valid_session_token");

		const { serverApiClient } = await import("#/lib/api-client.server");
		const mockClient = vi.mocked(serverApiClient);
		mockClient.mockResolvedValueOnce({
			success: true,
			data: { userId: "user_1", role: "participant" },
		});

		// getCurrentUser handler calls fetchCurrentUser via dynamic import
		const { fetchCurrentUser } = await import("#/lib/auth/server-fns.server");
		const result = await fetchCurrentUser();

		expect(result).toEqual({ userId: "user_1", role: "participant" });
		expect(mockClient).toHaveBeenCalledWith("/auth/session", {
			headers: expect.objectContaining({
				Cookie: "kiran_session=valid_session_token",
			}),
		});
	});

	it("returns null on 401 (unauthenticated)", async () => {
		mockHeaders.set("cookie", "kiran_session=expired_token");

		const { serverApiClient } = await import("#/lib/api-client.server");
		const mockClient = vi.mocked(serverApiClient);
		mockClient.mockRejectedValueOnce(
			new ApiClientError(401, "UNAUTHORIZED", "Session expired"),
		);

		const { fetchCurrentUser } = await import("#/lib/auth/server-fns.server");
		const result = await fetchCurrentUser();

		expect(result).toBeNull();
	});

	it("re-throws non-401 errors", async () => {
		mockHeaders.set("cookie", "kiran_session=some_token");

		const { serverApiClient } = await import("#/lib/api-client.server");
		const mockClient = vi.mocked(serverApiClient);
		mockClient.mockRejectedValueOnce(
			new ApiClientError(500, "INTERNAL_ERROR", "Server exploded"),
		);

		const { fetchCurrentUser } = await import("#/lib/auth/server-fns.server");

		await expect(fetchCurrentUser()).rejects.toThrow("Server exploded");
	});
});
