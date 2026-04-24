import { queryOptions } from "@tanstack/react-query";
import { getAdminVerificationDetail, getAdminVerifications } from "./api";

export const ADMIN_VERIFICATIONS_QUERY_KEY = [
	"admin",
	"verifications",
] as const;

export function adminVerificationsQueryOptions(params: {
	page?: number;
	limit?: number;
	status?: string;
}) {
	return queryOptions({
		queryKey: [...ADMIN_VERIFICATIONS_QUERY_KEY, params],
		queryFn: () => getAdminVerifications({ data: params }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}

export function adminVerificationDetailQueryOptions(organizerId: string) {
	return queryOptions({
		queryKey: [...ADMIN_VERIFICATIONS_QUERY_KEY, organizerId],
		queryFn: () => getAdminVerificationDetail({ data: { organizerId } }),
		staleTime: 30_000,
		gcTime: 300_000,
	});
}
