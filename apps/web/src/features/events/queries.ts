import { queryOptions } from "@tanstack/react-query";
import { getEventCategories, getEventPolicies, getEventPricing } from "./api";

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
