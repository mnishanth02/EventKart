/**
 * Browser-side API client for EventKart.
 *
 * - Uses `VITE_API_URL` (public endpoint) as the base URL.
 * - Sends `credentials: "include"` so the session cookie flows automatically.
 * - Auto-attaches the CSRF token from the `__csrf` cookie on mutating requests.
 *
 * For server-side (SSR / createServerFn) calls, use `serverApiClient` from
 * `#/lib/api-client.server` instead.
 */

import {
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
} from "@repo/shared/constants";
import { publicEnv } from "#/lib/env/public";
import {
	API_VERSION,
	isMutatingMethod,
	parseApiResponse,
} from "#/lib/api-client.shared";

// Re-export shared types so consumers can import from a single location
export {
	ApiClientError,
	API_VERSION,
	type ApiErrorBody,
	type RequestOptions,
} from "#/lib/api-client.shared";

// ── Helpers ────────────────────────────────────────────────────────

function getCsrfToken(): string | undefined {
	if (typeof document === "undefined") return undefined;
	const match = document.cookie
		.split("; ")
		.find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
	return match?.split("=").slice(1).join("=");
}

function getApiBaseUrl(): string {
	return publicEnv.VITE_API_URL;
}

// ── Browser API Client ─────────────────────────────────────────────

/**
 * Makes an API request from the browser.
 *
 * @example
 * ```ts
 * // GET request
 * const events = await apiClient<EventListResponse>("/events");
 *
 * // POST with body (CSRF token auto-attached)
 * const result = await apiClient<BookingResponse>("/bookings", {
 *   method: "POST",
 *   body: { eventId: "123", ticketCount: 2 },
 * });
 * ```
 */
export async function apiClient<T = unknown>(
	path: string,
	options: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
	const { method = "GET", body, headers = {}, signal } = options;
	const url = `${getApiBaseUrl()}${API_VERSION}${path}`;

	const requestHeaders: Record<string, string> = {
		Accept: "application/json",
		...headers,
	};

	if (body !== undefined) {
		requestHeaders["Content-Type"] = "application/json";
	}

	// Auto-attach CSRF token for mutating requests
	if (isMutatingMethod(method)) {
		const csrfToken = getCsrfToken();
		if (csrfToken) {
			requestHeaders[CSRF_HEADER_NAME] = csrfToken;
		}
	}

	const response = await fetch(url, {
		method,
		headers: requestHeaders,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		credentials: "include",
		signal,
	});

	return parseApiResponse<T>(response);
}
