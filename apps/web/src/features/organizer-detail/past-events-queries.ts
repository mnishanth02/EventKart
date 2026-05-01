import { queryOptions } from "@tanstack/react-query";
import { getOrganizerPastEvents } from "./past-events-api";
import type { PastEventsParams } from "./past-events-api.server";

/**
 * Query key for an organizer's past events list. Exported so other
 * modules (mutations, prefetches, invalidations) can reach the cache by
 * the same key without re-deriving it.
 */
export const organizerPastEventsQueryKey = (params: PastEventsParams) =>
	["organizer-past-events", "list", params] as const;

/**
 * `queryOptions` factory for an organizer's past events list. Used
 * by the route loader (`ensureQueryData`) and reused by client
 * components that read the same cache entry.
 *
 * `staleTime` matches the upcoming-events list freshness window so the
 * two sections on the organizer profile agree on when they refetch.
 */
export function organizerPastEventsQueryOptions(params: PastEventsParams) {
	return queryOptions({
		queryKey: organizerPastEventsQueryKey(params),
		queryFn: () => getOrganizerPastEvents({ data: params }),
		staleTime: 60_000,
		gcTime: 300_000,
	});
}
