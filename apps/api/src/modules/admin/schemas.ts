import {
	adminApproveBodySchema,
	adminEventApproveBodySchema,
	adminEventRejectBodySchema,
	adminEventReviewActionResponseSchema,
	adminEventReviewDetailSchema,
	adminEventReviewListItemSchema,
	adminEventReviewListParamsSchema,
	adminRejectBodySchema,
	adminRetryRazorpayResponseSchema,
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
export const listEventReviewsQuerySchema = adminEventReviewListParamsSchema;

export const organizerIdParamsSchema = z.object({
	organizerId: z.string().uuid(),
});

export const eventReviewIdParamsSchema = z.object({
	eventId: z.string().uuid(),
});

export const documentViewParamsSchema = z.object({
	organizerId: z.string().uuid(),
	documentId: z.string().uuid(),
});

export const approveBodySchema = adminApproveBodySchema;
export const rejectBodySchema = adminRejectBodySchema;
export const approveEventReviewBodySchema = adminEventApproveBodySchema;
export const rejectEventReviewBodySchema = adminEventRejectBodySchema;

// ── Response schemas ────────────────────────────────────────────────

export const listVerificationsResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(adminVerificationListItemSchema),
	meta: offsetPaginationMetaSchema,
});

export const listEventReviewsResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(adminEventReviewListItemSchema),
	meta: offsetPaginationMetaSchema,
});

export const verificationDetailResponseSchema = z.object({
	success: z.literal(true),
	data: adminVerificationDetailSchema,
});

export const eventReviewDetailResponseSchema = z.object({
	success: z.literal(true),
	data: adminEventReviewDetailSchema,
});

export const documentViewUrlResponseSchema = z.object({
	success: z.literal(true),
	data: documentViewUrlSchema,
});

export const reviewActionResponseSchema = z.object({
	success: z.literal(true),
	data: adminReviewActionResponseSchema,
});

export const eventReviewActionResponseSchema = z.object({
	success: z.literal(true),
	data: adminEventReviewActionResponseSchema,
});

export const adminErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});

export const retryRazorpayResponseSchema = z.object({
	success: z.literal(true),
	data: adminRetryRazorpayResponseSchema,
});
