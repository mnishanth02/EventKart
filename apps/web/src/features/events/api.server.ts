/**
 * Server-only event API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import type { CreateEvent, EventCategoriesConfig } from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import type { EventCategoriesResponse, EventResponse } from "./types";

/**
 * Creates a V1 event via POST /api/v1/events.
 * Forwards the user's session cookie for organizer auth.
 */
export async function createEventOnServer(
	data: CreateEvent,
): Promise<EventResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventResponse>("/events", {
		method: "POST",
		body: data,
		headers,
	});
}

/**
 * Lists configured distance categories via GET /api/v1/events/:eventId/categories.
 * Forwards the user's session cookie for organizer auth.
 */
export async function listEventCategoriesOnServer(
	eventId: string,
): Promise<EventCategoriesResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventCategoriesResponse>(
		`/events/${eventId}/categories`,
		{ headers },
	);
}

/**
 * Replaces configured distance categories via PUT /api/v1/events/:eventId/categories.
 * Forwards the user's session cookie for organizer auth.
 */
export async function replaceEventCategoriesOnServer(
	eventId: string,
	config: EventCategoriesConfig,
): Promise<EventCategoriesResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventCategoriesResponse>(
		`/events/${eventId}/categories`,
		{
			method: "PUT",
			body: config,
			headers,
		},
	);
}
