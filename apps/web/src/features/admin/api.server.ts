/**
 * Server-only admin API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import type { AdminApproveBody, AdminRejectBody } from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import { getForwardedAuthHeaders } from "#/lib/auth/server-fns.server";
import type {
	AdminReviewActionApiResponse,
	AdminVerificationDetailResponse,
	AdminVerificationListResponse,
	DocumentViewUrlResponse,
} from "./types";

/**
 * Fetches the paginated admin verification list.
 * GET /api/v1/admin/verifications?page=&limit=&status=
 */
export async function fetchAdminVerifications(params: {
	page?: number;
	limit?: number;
	status?: string;
}): Promise<AdminVerificationListResponse> {
	const headers = getForwardedAuthHeaders();
	const searchParams = new URLSearchParams();

	if (params.page != null) searchParams.set("page", String(params.page));
	if (params.limit != null) searchParams.set("limit", String(params.limit));
	if (params.status) searchParams.set("status", params.status);

	const qs = searchParams.toString();
	const path = `/admin/verifications${qs ? `?${qs}` : ""}`;

	return serverApiClient<AdminVerificationListResponse>(path, { headers });
}

/**
 * Fetches the admin verification detail for a specific organizer.
 * GET /api/v1/admin/verifications/:organizerId
 */
export async function fetchAdminVerificationDetail(
	organizerId: string,
): Promise<AdminVerificationDetailResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminVerificationDetailResponse>(
		`/admin/verifications/${organizerId}`,
		{ headers },
	);
}

/**
 * Fetches a presigned download URL for a verification document.
 * GET /api/v1/admin/verifications/:organizerId/documents/:documentId/view-url
 */
export async function fetchDocumentViewUrl(
	organizerId: string,
	documentId: string,
): Promise<DocumentViewUrlResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<DocumentViewUrlResponse>(
		`/admin/verifications/${organizerId}/documents/${documentId}/view-url`,
		{ headers },
	);
}

/**
 * Approves an organizer verification.
 * POST /api/v1/admin/verifications/:organizerId/approve
 */
export async function approveOrganizerOnServer(
	organizerId: string,
	body: AdminApproveBody,
): Promise<AdminReviewActionApiResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminReviewActionApiResponse>(
		`/admin/verifications/${organizerId}/approve`,
		{ method: "POST", body, headers },
	);
}

/**
 * Rejects an organizer verification.
 * POST /api/v1/admin/verifications/:organizerId/reject
 */
export async function rejectOrganizerOnServer(
	organizerId: string,
	body: AdminRejectBody,
): Promise<AdminReviewActionApiResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminReviewActionApiResponse>(
		`/admin/verifications/${organizerId}/reject`,
		{ method: "POST", body, headers },
	);
}
