import { queryOptions } from "@tanstack/react-query";
import { getCurrentUser } from "./api";

export const AUTH_QUERY_KEY = ["auth", "session"] as const;

export function sessionQueryOptions() {
	return queryOptions({
		queryKey: AUTH_QUERY_KEY,
		queryFn: () => getCurrentUser(),
		staleTime: 30_000,
		gcTime: 300_000,
		refetchOnWindowFocus: false,
	});
}
