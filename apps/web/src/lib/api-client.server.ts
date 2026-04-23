/**
 * Server-side API client for EventKart SSR / createServerFn calls.
 *
 * - Uses `INTERNAL_API_URL` (Railway internal network) as the base URL.
 * - Attaches `X-Internal-Key` header for server-to-server authentication
 *   (higher rate limits, CSRF bypass — by design for SSR).
 * - Accepts optional `headers` for cookie forwarding (used by I-0.2.9).
 * - Does NOT set `credentials: "include"` — cookies are forwarded
 *   explicitly via headers when needed.
 *
 * For browser-side calls, use `apiClient` from `#/lib/api-client` instead.
 */

import { serverEnv } from "#/lib/env/server";
import {
	API_VERSION,
	type RequestOptions,
	parseApiResponse,
} from "#/lib/api-client.shared";

// Re-export shared types for convenience
export { ApiClientError, type ApiErrorBody, type RequestOptions } from "#/lib/api-client.shared";

// ── Helpers ────────────────────────────────────────────────────────

function getServerApiBaseUrl(): string {
	return serverEnv.INTERNAL_API_URL ?? "http://localhost:3001";
}

// ── Server API Client ──────────────────────────────────────────────

/**
 * Makes an API request from the server (SSR / server functions).
 *
 * @example
 * ```ts
 * // GET request in a createServerFn
 * const events = await serverApiClient<EventListResponse>("/events");
 *
 * // With forwarded cookies (I-0.2.9 session forwarding)
 * const me = await serverApiClient<UserResponse>("/auth/me", {
 *   headers: { Cookie: request.headers.cookie },
 * });
 * ```
 */
export async function serverApiClient<T = unknown>(
	path: string,
	options: RequestOptions = {},
): Promise<T> {
	const { method = "GET", body, headers = {}, signal } = options;
	const url = `${getServerApiBaseUrl()}${API_VERSION}${path}`;

	const requestHeaders: Record<string, string> = {
		Accept: "application/json",
		...headers,
	};

	if (body !== undefined) {
		requestHeaders["Content-Type"] = "application/json";
	}

	// Attach internal API key for server-to-server auth.
	// This gives SSR requests CSRF bypass and higher rate limits — by design,
	// since server functions are already one-per-user-request.
	if (serverEnv.INTERNAL_API_KEY) {
		requestHeaders["X-Internal-Key"] = serverEnv.INTERNAL_API_KEY;
	}

	const response = await fetch(url, {
		method,
		headers: requestHeaders,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		signal,
	});

	return parseApiResponse<T>(response);
}
