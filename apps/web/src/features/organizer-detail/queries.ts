import { queryOptions } from "@tanstack/react-query";
import { getPublicOrganizer } from "./api";

/**
 * Query key for the public organizer profile lookup. Exported so other
 * modules (mutations, prefetches) can invalidate or read the cache by
 * the same key without re-deriving it.
 */
export const publicOrganizerQueryKey = (slug: string) =>
	["organizer-detail", "by-slug", slug] as const;

/**
 * `queryOptions` factory for the public organizer profile. Used by the
 * route loader (`ensureQueryData`) and may be reused by client
 * components that want to read the same cache entry.
 *
 * `staleTime` matches the CDN `s-maxage` (60s) so client and edge
 * freshness windows agree; `gcTime` matches the CDN SWR window (5min).
 */
export function publicOrganizerQueryOptions(slug: string) {
	return queryOptions({
		queryKey: publicOrganizerQueryKey(slug),
		queryFn: () => getPublicOrganizer({ data: { slug } }),
		staleTime: 60_000,
		gcTime: 300_000,
	});
}
