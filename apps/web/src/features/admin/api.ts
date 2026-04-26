/**
 * Admin server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import {
	adminApproveBodySchema,
	adminRejectBodySchema,
	adminVerificationListParamsSchema,
	type OffsetPaginationMeta,
	uuidSchema,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type {
	AdminReviewActionResponse,
	AdminVerificationDetail,
	AdminVerificationListItem,
	DocumentViewUrl,
} from "./types";

const organizerIdInputSchema = z.object({
	organizerId: uuidSchema,
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
