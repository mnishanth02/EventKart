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
	EventImageListQuery,
	EventImageUploadUrlRequest,
	EventPoliciesConfig,
	EventPricingConfig,
} from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import type { EventUpdatePayload } from "./form-values";
import type {
	EventCategoriesResponse,
	EventImageConfirmResponse,
	EventImageDeleteResponse,
	EventImagesResponse,
	EventImageUploadUrlApiResponse,
	EventPoliciesResponse,
	EventPricingResponse,
	EventResponse,
	PublishEventResponse,
	PublishReadinessResponse,
	UnpublishEventResponse,
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

export async function getEventOnServer(
	eventId: string,
): Promise<EventResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventResponse>(`/events/${eventId}`, { headers });
}

export async function getPublishReadinessOnServer(
	eventId: string,
): Promise<PublishReadinessResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<PublishReadinessResponse>(
		`/events/${eventId}/publish-readiness`,
		{ headers },
	);
}

export async function publishEventOnServer(
	eventId: string,
): Promise<PublishEventResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<PublishEventResponse>(`/events/${eventId}/publish`, {
		method: "POST",
		headers,
	});
}

export async function unpublishEventOnServer(
	eventId: string,
): Promise<UnpublishEventResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<UnpublishEventResponse>(
		`/events/${eventId}/unpublish`,
		{
			method: "POST",
			headers,
		},
	);
}

export async function updateEventOnServer(
	eventId: string,
	data: EventUpdatePayload,
): Promise<EventResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventResponse>(`/events/${eventId}`, {
		method: "PUT",
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

export async function listEventImagesOnServer(
	eventId: string,
	query: EventImageListQuery = {},
): Promise<EventImagesResponse> {
	const headers = getForwardedAuthHeaders();
	const params = new URLSearchParams();
	if (query.kind) params.set("kind", query.kind);
	if (query.status) params.set("status", query.status);
	const qs = params.toString();

	return serverApiClient<EventImagesResponse>(
		`/events/${eventId}/images${qs ? `?${qs}` : ""}`,
		{ headers },
	);
}

export async function requestEventImageUploadUrlOnServer(
	eventId: string,
	data: EventImageUploadUrlRequest,
): Promise<EventImageUploadUrlApiResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventImageUploadUrlApiResponse>(
		`/events/${eventId}/images/upload-url`,
		{
			method: "POST",
			body: data,
			headers,
		},
	);
}

export async function confirmEventImageUploadOnServer(
	eventId: string,
	imageId: string,
): Promise<EventImageConfirmResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventImageConfirmResponse>(
		`/events/${eventId}/images/${imageId}/confirm`,
		{ method: "POST", headers },
	);
}

export async function deleteEventImageOnServer(
	eventId: string,
	imageId: string,
): Promise<EventImageDeleteResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<EventImageDeleteResponse>(
		`/events/${eventId}/images/${imageId}`,
		{ method: "DELETE", headers },
	);
}
