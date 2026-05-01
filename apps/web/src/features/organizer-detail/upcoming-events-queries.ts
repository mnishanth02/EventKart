import { queryOptions } from "@tanstack/react-query";
import { getOrganizerUpcomingEvents } from "./upcoming-events-api";
import type { UpcomingEventsParams } from "./upcoming-events-api.server";

/**
 * Query key for an organizer's upcoming events list. Exported so other
 * modules (mutations, prefetches, invalidations) can reach the cache by
 * the same key without re-deriving it.
 */
export const organizerUpcomingEventsQueryKey = (params: UpcomingEventsParams) =>
	["organizer-upcoming-events", "list", params] as const;

/**
 * `queryOptions` factory for an organizer's upcoming events list. Used
 * by the route loader (`ensureQueryData`) and reused by client
 * components that read the same cache entry.
 *
 * `staleTime` matches the public-events list freshness window so the
 * organizer profile and the homepage agree on when they refetch.
 */
export function organizerUpcomingEventsQueryOptions(
	params: UpcomingEventsParams,
) {
	return queryOptions({
		queryKey: organizerUpcomingEventsQueryKey(params),
		queryFn: () => getOrganizerUpcomingEvents({ data: params }),
		staleTime: 60_000,
		gcTime: 300_000,
	});
}
