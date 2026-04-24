import { z } from "zod/v4";
import { verificationStatusSchema } from "../constants/verification.js";
import {
	organizerProfileSchema,
	verificationDocumentSchema,
} from "./organizer.js";
import { offsetPaginationSchema } from "./pagination.js";

// ── Admin verification list query params ──────────────────────────

export const adminVerificationListParamsSchema = offsetPaginationSchema.extend({
	status: verificationStatusSchema.optional(),
});

export type AdminVerificationListParams = z.infer<
	typeof adminVerificationListParamsSchema
>;

// ── Admin verification list item ──────────────────────────────────

export const adminVerificationListItemSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	businessName: z.string(),
	contactName: z.string(),
	contactEmail: z.string(),
	city: z.string(),
	verificationStatus: z.string(),
	submittedForReviewAt: z.string().nullable(),
	documentCount: z.number().int(),
	createdAt: z.string(),
});

export type AdminVerificationListItem = z.infer<
	typeof adminVerificationListItemSchema
>;

// ── Admin verification detail ─────────────────────────────────────

export const adminVerificationDetailSchema = z.object({
	organizer: organizerProfileSchema,
	documents: z.array(verificationDocumentSchema),
	policiesAccepted: z.boolean(),
	policyDetails: z.array(
		z.object({
			policyType: z.string(),
			isAccepted: z.boolean(),
			acceptedAt: z.string().nullable(),
			version: z.string().nullable(),
		}),
	),
});

export type AdminVerificationDetail = z.infer<
	typeof adminVerificationDetailSchema
>;

// ── Document view URL response ────────────────────────────────────

export const documentViewUrlSchema = z.object({
	url: z.string().url(),
	expiresAt: z.string(),
	documentId: z.string().uuid(),
	documentType: z.string(),
	fileName: z.string(),
	contentType: z.string(),
});

export type DocumentViewUrl = z.infer<typeof documentViewUrlSchema>;

// ── Approve request body ──────────────────────────────────────────

export const adminApproveBodySchema = z.object({
	notes: z
		.string()
		.max(2000, "Notes must not exceed 2000 characters")
		.trim()
		.optional(),
});

export type AdminApproveBody = z.infer<typeof adminApproveBodySchema>;

// ── Reject request body ───────────────────────────────────────────

export const adminRejectBodySchema = z.object({
	reason: z
		.string()
		.min(10, "Rejection reason must be at least 10 characters")
		.max(2000, "Rejection reason must not exceed 2000 characters")
		.trim(),
});

export type AdminRejectBody = z.infer<typeof adminRejectBodySchema>;

// ── Review action response ────────────────────────────────────────

export const adminReviewActionResponseSchema = z.object({
	organizerId: z.string().uuid(),
	verificationStatus: z.string(),
	isVerified: z.boolean(),
	reviewedAt: z.string(),
	reviewedBy: z.string().uuid(),
});

export type AdminReviewActionResponse = z.infer<
	typeof adminReviewActionResponseSchema
>;
