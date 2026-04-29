/**
 * Server-only admin API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import type {
	AdminApproveBody,
	AdminEventApproveBody,
	AdminEventRejectBody,
	AdminRejectBody,
} from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import type {
	AdminEventReviewActionApiResponse,
	AdminEventReviewDetailResponse,
	AdminEventReviewListResponse,
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
 * Fetches the paginated admin event review list.
 * GET /api/v1/admin/event-reviews?page=&limit=&status=
 */
export async function fetchAdminEventReviews(params: {
	page?: number;
	limit?: number;
	status?: string;
}): Promise<AdminEventReviewListResponse> {
	const headers = getForwardedAuthHeaders();
	const searchParams = new URLSearchParams();

	if (params.page != null) searchParams.set("page", String(params.page));
	if (params.limit != null) searchParams.set("limit", String(params.limit));
	if (params.status) searchParams.set("status", params.status);

	const qs = searchParams.toString();
	const path = `/admin/event-reviews${qs ? `?${qs}` : ""}`;

	return serverApiClient<AdminEventReviewListResponse>(path, { headers });
}

/**
 * Fetches the admin event review detail for a specific event.
 * GET /api/v1/admin/event-reviews/:eventId
 */
export async function fetchAdminEventReviewDetail(
	eventId: string,
): Promise<AdminEventReviewDetailResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminEventReviewDetailResponse>(
		`/admin/event-reviews/${eventId}`,
		{ headers },
	);
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

/**
 * Approves an event review.
 * POST /api/v1/admin/event-reviews/:eventId/approve
 */
export async function approveEventReviewOnServer(
	eventId: string,
	body: AdminEventApproveBody,
): Promise<AdminEventReviewActionApiResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminEventReviewActionApiResponse>(
		`/admin/event-reviews/${eventId}/approve`,
		{ method: "POST", body, headers },
	);
}

/**
 * Rejects an event review.
 * POST /api/v1/admin/event-reviews/:eventId/reject
 */
export async function rejectEventReviewOnServer(
	eventId: string,
	body: AdminEventRejectBody,
): Promise<AdminEventReviewActionApiResponse> {
	assertSameOriginMutationRequest();
	const headers = getForwardedAuthHeaders();
	return serverApiClient<AdminEventReviewActionApiResponse>(
		`/admin/event-reviews/${eventId}/reject`,
		{ method: "POST", body, headers },
	);
}
