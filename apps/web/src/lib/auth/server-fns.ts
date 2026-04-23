/**
 * SSR session forwarding helpers.
 *
 * These utilities allow TanStack Start server functions to call the
 * Fastify API with the user's session cookie, enabling authenticated
 * SSR rendering without exposing unrelated cookies to the backend.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { SESSION_COOKIE_NAME } from "@repo/shared/constants/session";
import { userRoleSchema } from "@repo/shared/constants/roles";
import type { UserRole } from "@repo/shared/constants/roles";
import {
	serverApiClient,
	ApiClientError,
} from "#/lib/api-client.server";

// ── Types ──────────────────────────────────────────────────────────

export type AuthSession = {
	userId: string;
	role: UserRole;
};

type SessionApiResponse = {
	success: true;
	data: AuthSession;
};

// ── Private Helpers ────────────────────────────────────────────────

/**
 * Extracts a single cookie value from a raw `Cookie` header string.
 * Returns `undefined` when the cookie is not present.
 */
function extractCookie(
	cookieHeader: string,
	name: string,
): string | undefined {
	const cookies = cookieHeader.split(";");
	for (const cookie of cookies) {
		const [cookieName, ...rest] = cookie.trim().split("=");
		if (cookieName === name) {
			return rest.join("=");
		}
	}
	return undefined;
}

// ── Public Helpers ─────────────────────────────────────────────────

/**
 * Reads the incoming SSR request and builds a filtered headers object
 * that only forwards the session cookie (not the entire cookie jar)
 * and the `x-request-id` header for request correlation.
 */
export function getForwardedAuthHeaders(): Record<string, string> {
	const headers: Record<string, string> = {};

	// Forward only the session cookie (not the entire cookie jar)
	const cookieHeader = getRequestHeader("cookie");
	if (cookieHeader) {
		const sessionCookie = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
		if (sessionCookie) {
			headers["Cookie"] = `${SESSION_COOKIE_NAME}=${sessionCookie}`;
		}
	}

	// Forward request ID for tracing
	const requestId = getRequestHeader("x-request-id");
	if (requestId) {
		headers["X-Request-ID"] = requestId;
	}

	return headers;
}

// ── Server Functions ───────────────────────────────────────────────

/**
 * Server function that returns the current authenticated user session,
 * or `null` when unauthenticated (401 from the API).
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
	async (): Promise<AuthSession | null> => {
		const headers = getForwardedAuthHeaders();

		try {
			const response = await serverApiClient<SessionApiResponse>(
				"/auth/session",
				{ headers },
			);
			const roleResult = userRoleSchema.safeParse(response.data.role);
			if (!roleResult.success) {
				return null;
			}
			return { userId: response.data.userId, role: roleResult.data };
		} catch (error: unknown) {
			if (error instanceof ApiClientError && error.status === 401) {
				return null;
			}
			throw error;
		}
	},
);
