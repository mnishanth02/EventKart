import { queryOptions } from "@tanstack/react-query";
import { getOrganizerProfile } from "./api";

export const ORGANIZER_QUERY_KEY = ["organizer", "profile"] as const;

export function organizerProfileQueryOptions() {
	return queryOptions({
		queryKey: ORGANIZER_QUERY_KEY,
		queryFn: () => getOrganizerProfile(),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}
