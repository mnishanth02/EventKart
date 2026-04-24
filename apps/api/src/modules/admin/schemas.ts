import {
	adminApproveBodySchema,
	adminRejectBodySchema,
	adminReviewActionResponseSchema,
	adminVerificationDetailSchema,
	adminVerificationListItemSchema,
	adminVerificationListParamsSchema,
	documentViewUrlSchema,
	offsetPaginationMetaSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

// ── Request schemas ─────────────────────────────────────────────────

export const listVerificationsQuerySchema = adminVerificationListParamsSchema;

export const organizerIdParamsSchema = z.object({
	organizerId: z.string().uuid(),
});

export const documentViewParamsSchema = z.object({
	organizerId: z.string().uuid(),
	documentId: z.string().uuid(),
});

export const approveBodySchema = adminApproveBodySchema;
export const rejectBodySchema = adminRejectBodySchema;

// ── Response schemas ────────────────────────────────────────────────

export const listVerificationsResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(adminVerificationListItemSchema),
	meta: offsetPaginationMetaSchema,
});

export const verificationDetailResponseSchema = z.object({
	success: z.literal(true),
	data: adminVerificationDetailSchema,
});

export const documentViewUrlResponseSchema = z.object({
	success: z.literal(true),
	data: documentViewUrlSchema,
});

export const reviewActionResponseSchema = z.object({
	success: z.literal(true),
	data: adminReviewActionResponseSchema,
});

export const adminErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});
