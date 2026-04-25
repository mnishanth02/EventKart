/**
 * Shared types, error class, and constants for the API client.
 * This file has NO environment imports — safe to import from both
 * browser (`api-client.ts`) and server (`api-client.server.ts`) code.
 */

export const API_VERSION = "/api/v1";

// ── Types ──────────────────────────────────────────────────────────

/** Shape of error responses from the Fastify API error handler. */
export interface ApiErrorBody {
	success: false;
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

/** Options accepted by both browser and server API clients. */
export interface RequestOptions {
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

// ── Error Class ────────────────────────────────────────────────────

/**
 * Typed error thrown when the API returns a non-2xx response.
 * Fields mirror the API's error envelope for easy consumption.
 */
export class ApiClientError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: Record<string, unknown>;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "ApiClientError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

// ── Response Helpers ───────────────────────────────────────────────

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export function isMutatingMethod(method: string): boolean {
	return MUTATING_METHODS.has(method.toUpperCase());
}

/**
 * Parses a fetch Response, throwing ApiClientError on non-2xx.
 * Returns undefined for empty responses (204, zero content-length).
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorBody = (await response
			.json()
			.catch(() => null)) as ApiErrorBody | null;
		throw new ApiClientError(
			response.status,
			errorBody?.error?.code ?? "UNKNOWN_ERROR",
			errorBody?.error?.message ?? response.statusText,
			errorBody?.error?.details,
		);
	}

	// Handle empty responses generically
	if (
		response.status === 204 ||
		response.headers.get("content-length") === "0"
	) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}
