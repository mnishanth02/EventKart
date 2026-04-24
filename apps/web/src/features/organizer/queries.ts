import { queryOptions } from "@tanstack/react-query";
import { getOrganizerPolicyStatus, getOrganizerProfile } from "./api";

export const ORGANIZER_QUERY_KEY = ["organizer", "profile"] as const;

export const POLICY_STATUS_QUERY_KEY = ["organizer", "policies"] as const;

export function organizerProfileQueryOptions() {
	return queryOptions({
		queryKey: ORGANIZER_QUERY_KEY,
		queryFn: () => getOrganizerProfile(),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export function policyStatusQueryOptions() {
	return queryOptions({
		queryKey: POLICY_STATUS_QUERY_KEY,
		queryFn: () => getOrganizerPolicyStatus(),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}
