/**
 * Server-only event API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import type {
	CreateEvent,
	EventCategoriesConfig,
	EventPoliciesConfig,
	EventPricingConfig,
} from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import type {
	EventCategoriesResponse,
	EventPoliciesResponse,
	EventPricingResponse,
	EventResponse,
} from "./types";

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

export async function listEventCategoriesOnServer(
	eventId: string,
): Promise<EventCategoriesResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventCategoriesResponse>(
		`/events/${eventId}/categories`,
		{ headers },
	);
}

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

export async function getEventPoliciesOnServer(
	eventId: string,
): Promise<EventPoliciesResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventPoliciesResponse>(`/events/${eventId}/policies`, {
		headers,
	});
}

export async function updateEventPoliciesOnServer(
	eventId: string,
	config: EventPoliciesConfig,
): Promise<EventPoliciesResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventPoliciesResponse>(`/events/${eventId}/policies`, {
		method: "PUT",
		body: config,
		headers,
	});
}

export async function listEventPricingOnServer(
	eventId: string,
): Promise<EventPricingResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventPricingResponse>(`/events/${eventId}/pricing`, {
		headers,
	});
}

export async function replaceEventPricingOnServer(
	eventId: string,
	config: EventPricingConfig,
): Promise<EventPricingResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventPricingResponse>(`/events/${eventId}/pricing`, {
		method: "PUT",
		body: config,
		headers,
	});
}
