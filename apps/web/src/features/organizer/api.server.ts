/**
 * Server-only organizer API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import { getForwardedAuthHeaders } from "#/lib/auth/server-fns.server";
import { serverApiClient } from "#/lib/api-client.server";
import type { OrganizerProfileResponse } from "./types";
import type { OrganizerRegistrationInput } from "@repo/shared/schemas";

/**
 * Registers an organizer profile via POST /api/v1/organizers.
 * Forwards the user's session cookie for auth.
 */
export async function registerOrganizerOnServer(
	data: OrganizerRegistrationInput,
): Promise<OrganizerProfileResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<OrganizerProfileResponse>("/organizers", {
		method: "POST",
		body: data,
		headers,
	});
}

/**
 * Fetches the current user's organizer profile via GET /api/v1/organizers/me.
 * Returns `null` when no profile exists (404 from the API).
 */
export async function fetchOrganizerProfile(): Promise<OrganizerProfileResponse | null> {
	const headers = getForwardedAuthHeaders();

	try {
		return await serverApiClient<OrganizerProfileResponse>(
			"/organizers/me",
			{ headers },
		);
	} catch (error: unknown) {
		const { ApiClientError } = await import("#/lib/api-client.server");
		if (error instanceof ApiClientError && error.status === 404) {
			return null;
		}
		throw error;
	}
}
