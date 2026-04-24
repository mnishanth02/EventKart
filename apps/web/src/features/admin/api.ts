/**
 * Admin server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import type {
	AdminApproveBody,
	AdminRejectBody,
	OffsetPaginationMeta,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import type {
	AdminReviewActionResponse,
	AdminVerificationDetail,
	AdminVerificationListItem,
	DocumentViewUrl,
} from "./types";

// ── List Verifications ─────────────────────────────────────────────

export const getAdminVerifications = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { page?: number; limit?: number; status?: string }) => data,
	)
	.handler(
		async ({
			data,
		}): Promise<{
			items: AdminVerificationListItem[];
			meta: OffsetPaginationMeta;
		}> => {
			const { fetchAdminVerifications } = await import("./api.server");
			const response = await fetchAdminVerifications(data);
			return { items: response.data, meta: response.meta };
		},
	);

// ── Verification Detail ────────────────────────────────────────────

export const getAdminVerificationDetail = createServerFn({ method: "GET" })
	.inputValidator((data: { organizerId: string }) => data)
	.handler(async ({ data }): Promise<AdminVerificationDetail> => {
		const { fetchAdminVerificationDetail } = await import("./api.server");
		const response = await fetchAdminVerificationDetail(data.organizerId);
		return response.data;
	});

// ── Document View URL ──────────────────────────────────────────────

export const getDocumentViewUrl = createServerFn({ method: "GET" })
	.inputValidator((data: { documentId: string }) => data)
	.handler(async ({ data }): Promise<DocumentViewUrl> => {
		const { fetchDocumentViewUrl } = await import("./api.server");
		const response = await fetchDocumentViewUrl(data.documentId);
		return response.data;
	});

// ── Approve Organizer ──────────────────────────────────────────────

export const approveOrganizer = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { organizerId: string; body: AdminApproveBody }) => data,
	)
	.handler(async ({ data }): Promise<AdminReviewActionResponse> => {
		const { approveOrganizerOnServer } = await import("./api.server");
		const response = await approveOrganizerOnServer(
			data.organizerId,
			data.body,
		);
		return response.data;
	});

// ── Reject Organizer ───────────────────────────────────────────────

export const rejectOrganizer = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { organizerId: string; body: AdminRejectBody }) => data,
	)
	.handler(async ({ data }): Promise<AdminReviewActionResponse> => {
		const { rejectOrganizerOnServer } = await import("./api.server");
		const response = await rejectOrganizerOnServer(data.organizerId, data.body);
		return response.data;
	});
