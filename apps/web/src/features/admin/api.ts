/**
 * Admin server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import {
	adminApproveBodySchema,
	adminEventApproveBodySchema,
	adminEventRejectBodySchema,
	adminEventReviewListParamsSchema,
	adminRejectBodySchema,
	adminVerificationListParamsSchema,
	type OffsetPaginationMeta,
	uuidSchema,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type {
	AdminReviewActionResponse,
	AdminEventReviewActionResponse,
	AdminEventReviewDetail,
	AdminEventReviewListItem,
	AdminVerificationDetail,
	AdminVerificationListItem,
	DocumentViewUrl,
} from "./types";

const organizerIdInputSchema = z.object({
	organizerId: uuidSchema,
});

const eventIdInputSchema = z.object({
	eventId: uuidSchema,
});

const documentViewUrlInputSchema = organizerIdInputSchema.extend({
	documentId: uuidSchema,
});

const approveOrganizerInputSchema = z.object({
	organizerId: uuidSchema,
	body: adminApproveBodySchema,
});

const rejectOrganizerInputSchema = z.object({
	organizerId: uuidSchema,
	body: adminRejectBodySchema,
});

const approveEventReviewInputSchema = z.object({
	eventId: uuidSchema,
	body: adminEventApproveBodySchema,
});

const rejectEventReviewInputSchema = z.object({
	eventId: uuidSchema,
	body: adminEventRejectBodySchema,
});

// ── List Verifications ─────────────────────────────────────────────

export const getAdminVerifications = createServerFn({ method: "GET" })
	.inputValidator((data) => adminVerificationListParamsSchema.parse(data ?? {}))
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

// ── List Event Reviews ─────────────────────────────────────────────

export const getAdminEventReviews = createServerFn({ method: "GET" })
	.inputValidator((data) => adminEventReviewListParamsSchema.parse(data ?? {}))
	.handler(
		async ({
			data,
		}): Promise<{
			items: AdminEventReviewListItem[];
			meta: OffsetPaginationMeta;
		}> => {
			const { fetchAdminEventReviews } = await import("./api.server");
			const response = await fetchAdminEventReviews(data);
			return { items: response.data, meta: response.meta };
		},
	);

// ── Event Review Detail ────────────────────────────────────────────

export const getAdminEventReviewDetail = createServerFn({ method: "GET" })
	.inputValidator((data) => eventIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<AdminEventReviewDetail> => {
		const { fetchAdminEventReviewDetail } = await import("./api.server");
		const response = await fetchAdminEventReviewDetail(data.eventId);
		return response.data;
	});

// ── Verification Detail ────────────────────────────────────────────

export const getAdminVerificationDetail = createServerFn({ method: "GET" })
	.inputValidator((data) => organizerIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<AdminVerificationDetail> => {
		const { fetchAdminVerificationDetail } = await import("./api.server");
		const response = await fetchAdminVerificationDetail(data.organizerId);
		return response.data;
	});

// ── Document View URL ──────────────────────────────────────────────

export const getDocumentViewUrl = createServerFn({ method: "GET" })
	.inputValidator((data) => documentViewUrlInputSchema.parse(data))
	.handler(async ({ data }): Promise<DocumentViewUrl> => {
		const { fetchDocumentViewUrl } = await import("./api.server");
		const response = await fetchDocumentViewUrl(
			data.organizerId,
			data.documentId,
		);
		return response.data;
	});

// ── Approve Organizer ──────────────────────────────────────────────

export const approveOrganizer = createServerFn({ method: "POST" })
	.inputValidator((data) => approveOrganizerInputSchema.parse(data))
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
	.inputValidator((data) => rejectOrganizerInputSchema.parse(data))
	.handler(async ({ data }): Promise<AdminReviewActionResponse> => {
		const { rejectOrganizerOnServer } = await import("./api.server");
		const response = await rejectOrganizerOnServer(data.organizerId, data.body);
		return response.data;
	});

// ── Approve Event Review ───────────────────────────────────────────

export const approveEventReview = createServerFn({ method: "POST" })
	.inputValidator((data) => approveEventReviewInputSchema.parse(data))
	.handler(async ({ data }): Promise<AdminEventReviewActionResponse> => {
		const { approveEventReviewOnServer } = await import("./api.server");
		const response = await approveEventReviewOnServer(data.eventId, data.body);
		return response.data;
	});

// ── Reject Event Review ────────────────────────────────────────────

export const rejectEventReview = createServerFn({ method: "POST" })
	.inputValidator((data) => rejectEventReviewInputSchema.parse(data))
	.handler(async ({ data }): Promise<AdminEventReviewActionResponse> => {
		const { rejectEventReviewOnServer } = await import("./api.server");
		const response = await rejectEventReviewOnServer(data.eventId, data.body);
		return response.data;
	});
