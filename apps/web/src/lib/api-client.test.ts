import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/env/public", () => ({
	publicEnv: {
		VITE_API_URL: "http://test-api.example.com",
	},
}));

vi.mock("@repo/shared/constants", () => ({
	CSRF_COOKIE_NAME: "__csrf",
	CSRF_HEADER_NAME: "x-csrf-token",
}));

import { ApiClientError, apiClient } from "#/lib/api-client";

// ── Helpers ────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof globalThis.fetch>();

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: init?.status ?? 200,
		statusText: init?.statusText ?? "OK",
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});
}

function emptyResponse(status: number): Response {
	return new Response(null, {
		status,
		statusText: status === 204 ? "No Content" : "OK",
		headers: { "Content-Length": "0" },
	});
}

function clearCookies(): void {
	document.cookie.split(";").forEach((c) => {
		const name = c.split("=")[0]?.trim();
		if (name) {
			// biome-ignore lint/suspicious/noDocumentCookie: test helper for CSRF cookie tests
			document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
		}
	});
}

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	mockFetch.mockReset();
	clearCookies();
	vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────

describe("apiClient (browser)", () => {
	describe("GET requests", () => {
		it("calls fetch with correct URL, method, Accept header, and credentials", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ data: "ok" }));

			await apiClient("/events");

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, init] = mockFetch.mock.calls[0] ?? [];
			expect(url).toBe("http://test-api.example.com/api/v1/events");
			expect(init?.method).toBe("GET");
			expect(init?.credentials).toBe("include");
			expect((init?.headers as Record<string, string>).Accept).toBe(
				"application/json",
			);
		});

		it("does NOT attach CSRF token on GET", async () => {
			// biome-ignore lint/suspicious/noDocumentCookie: testing CSRF cookie extraction
			document.cookie = "__csrf=should-not-appear";
			mockFetch.mockResolvedValueOnce(jsonResponse({}));

			await apiClient("/events");

			const headers = (mockFetch.mock.calls[0] ?? [])[1]?.headers as Record<
				string,
				string
			>;
			expect(headers["x-csrf-token"]).toBeUndefined();
		});
	});

	describe("mutating requests (POST, PUT, DELETE, PATCH)", () => {
		it("sends JSON body and Content-Type header on POST", async () => {
			// biome-ignore lint/suspicious/noDocumentCookie: testing CSRF cookie extraction
			document.cookie = "__csrf=tok123";
			mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));

			await apiClient("/bookings", {
				method: "POST",
				body: { eventId: "e1", count: 2 },
			});

			const [, init] = mockFetch.mock.calls[0] ?? [];
			expect(init?.method).toBe("POST");
			expect(init?.body).toBe(
				JSON.stringify({ eventId: "e1", count: 2 }),
			);
			expect((init?.headers as Record<string, string>)["Content-Type"]).toBe(
				"application/json",
			);
		});

		it.each(["POST", "PUT", "DELETE", "PATCH"])(
			"attaches CSRF token for %s requests",
			async (method) => {
				// biome-ignore lint/suspicious/noDocumentCookie: testing CSRF cookie extraction
				document.cookie = "__csrf=csrf-val";
				mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

				await apiClient("/resource", { method, body: {} });

				const headers = (mockFetch.mock.calls[0] ?? [])[1]?.headers as Record<
					string,
					string
				>;
				expect(headers["x-csrf-token"]).toBe("csrf-val");
			},
		);
	});

	describe("CSRF token extraction", () => {
		it("extracts __csrf from a cookie string with multiple cookies", async () => {
			// biome-ignore lint/suspicious/noDocumentCookie: testing CSRF cookie extraction
			document.cookie = "__csrf=test-token";
			// biome-ignore lint/suspicious/noDocumentCookie: testing CSRF cookie extraction
			document.cookie = "other=value";
			mockFetch.mockResolvedValueOnce(jsonResponse({}));

			await apiClient("/action", { method: "POST", body: {} });

			const headers = (mockFetch.mock.calls[0] ?? [])[1]?.headers as Record<
				string,
				string
			>;
			expect(headers["x-csrf-token"]).toBe("test-token");
		});

		it("omits CSRF header when cookie is absent", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}));

			await apiClient("/action", { method: "POST", body: {} });

			const headers = (mockFetch.mock.calls[0] ?? [])[1]?.headers as Record<
				string,
				string
			>;
			expect(headers["x-csrf-token"]).toBeUndefined();
		});
	});

	describe("empty responses", () => {
		it("returns undefined for 204 No Content", async () => {
			mockFetch.mockResolvedValueOnce(emptyResponse(204));

			const result = await apiClient("/resource", { method: "DELETE" });

			expect(result).toBeUndefined();
		});

		it("returns undefined when content-length is 0", async () => {
			mockFetch.mockResolvedValueOnce(emptyResponse(200));

			const result = await apiClient("/resource");

			expect(result).toBeUndefined();
		});
	});

	describe("error handling", () => {
		it("throws ApiClientError with status, code, message, and details on 4xx", async () => {
			const errorBody = {
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid input",
					details: { field: "email" },
				},
			};
			mockFetch.mockResolvedValueOnce(
				jsonResponse(errorBody, { status: 422, statusText: "Unprocessable Entity" }),
			);

			const err = await apiClient("/users").catch((e: unknown) => e);

			expect(err).toBeInstanceOf(ApiClientError);
			const apiErr = err as ApiClientError;
			expect(apiErr.status).toBe(422);
			expect(apiErr.code).toBe("VALIDATION_ERROR");
			expect(apiErr.message).toBe("Invalid input");
			expect(apiErr.details).toEqual({ field: "email" });
		});

		it("falls back to UNKNOWN_ERROR and statusText when JSON is unparseable", async () => {
			mockFetch.mockResolvedValueOnce(
				new Response("not json", {
					status: 500,
					statusText: "Internal Server Error",
				}),
			);

			const err = await apiClient("/broken").catch((e: unknown) => e);

			expect(err).toBeInstanceOf(ApiClientError);
			const apiErr = err as ApiClientError;
			expect(apiErr.status).toBe(500);
			expect(apiErr.code).toBe("UNKNOWN_ERROR");
			expect(apiErr.message).toBe("Internal Server Error");
			expect(apiErr.details).toBeUndefined();
		});
	});

	describe("custom headers and signal", () => {
		it("passes custom headers through to fetch", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}));

			await apiClient("/events", {
				headers: { "X-Custom": "hello" },
			});

			const headers = (mockFetch.mock.calls[0] ?? [])[1]?.headers as Record<
				string,
				string
			>;
			expect(headers["X-Custom"]).toBe("hello");
			expect(headers.Accept).toBe("application/json");
		});

		it("forwards AbortSignal to fetch", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}));
			const controller = new AbortController();

			await apiClient("/events", { signal: controller.signal });

			expect((mockFetch.mock.calls[0] ?? [])[1]?.signal).toBe(controller.signal);
		});
	});
});
