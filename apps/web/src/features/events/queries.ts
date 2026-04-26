import { queryOptions } from "@tanstack/react-query";
import { getEventCategories } from "./api";

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
