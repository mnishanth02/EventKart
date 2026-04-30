import { queryOptions } from "@tanstack/react-query";
import { getPublicEventsList } from "./api";
import type { PublicEventsListParams } from "./api.server";

export const publicEventsListQueryKey = (params: PublicEventsListParams) =>
	["public-events", "list", params] as const;

export function publicEventsListQueryOptions(params: PublicEventsListParams) {
	return queryOptions({
		queryKey: publicEventsListQueryKey(params),
		queryFn: () => getPublicEventsList({ data: params }),
		staleTime: 60_000,
		gcTime: 300_000,
	});
}
