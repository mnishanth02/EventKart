import { queryOptions } from "@tanstack/react-query";
import { getPublicEvent } from "./api";

export const publicEventQueryKey = (slug: string) =>
	["public-events", slug] as const;

export function publicEventQueryOptions(slug: string) {
	return queryOptions({
		queryKey: publicEventQueryKey(slug),
		queryFn: () => getPublicEvent({ data: { slug } }),
		staleTime: 60_000,
		gcTime: 300_000,
	});
}
