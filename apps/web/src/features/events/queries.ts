import { queryOptions } from "@tanstack/react-query";
import {
	getEvent,
	getEventCategories,
	getEventImages,
	getEventPolicies,
	getEventPricing,
	getPublishReadiness,
} from "./api";
import type { EventImageListQuery } from "./types";

export const eventQueryKey = (eventId: string) => ["events", eventId] as const;

export function eventQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: eventQueryKey(eventId),
		queryFn: () => getEvent({ data: { eventId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export const publishReadinessQueryKey = (eventId: string) =>
	["events", eventId, "publish-readiness"] as const;

export function publishReadinessQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: publishReadinessQueryKey(eventId),
		queryFn: () => getPublishReadiness({ data: { eventId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export const eventCategoriesQueryKey = (eventId: string) =>
	["events", eventId, "categories"] as const;

export function eventCategoriesQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: eventCategoriesQueryKey(eventId),
		queryFn: () => getEventCategories({ data: { eventId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export const eventPricingQueryKey = (eventId: string) =>
	["events", eventId, "pricing"] as const;

export function eventPricingQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: eventPricingQueryKey(eventId),
		queryFn: () => getEventPricing({ data: { eventId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export const eventPoliciesQueryKey = (eventId: string) =>
	["events", eventId, "policies"] as const;

export function eventPoliciesQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: eventPoliciesQueryKey(eventId),
		queryFn: () => getEventPolicies({ data: { eventId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export const eventImagesQueryKey = (eventId: string) =>
	["events", eventId, "images"] as const;

export function eventImagesQueryOptions(
	eventId: string,
	filter: EventImageListQuery = {},
) {
	return queryOptions({
		queryKey: [...eventImagesQueryKey(eventId), filter] as const,
		queryFn: () => getEventImages({ data: { eventId, ...filter } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}
