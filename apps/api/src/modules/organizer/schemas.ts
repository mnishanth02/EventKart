import {
	documentUploadRequestSchema,
	organizerProfileSchema,
	organizerRegistrationSchema,
	organizerUpdateBaseSchema,
	policyAcceptanceRequestSchema,
	policyStatusResponseSchema,
	presignedUploadUrlSchema,
	verificationDocumentSchema,
	verificationStatusResponseSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

// ── Request schemas ─────────────────────────────────────────────────

export const registerOrganizerBodySchema = organizerRegistrationSchema;

export const updateOrganizerBodySchema = organizerUpdateBaseSchema;

// ── Response schemas ────────────────────────────────────────────────

export const registerOrganizerResponseSchema = z.object({
	success: z.literal(true),
	data: organizerProfileSchema,
});

export const updateOrganizerResponseSchema = z.object({
	success: z.literal(true),
	data: organizerProfileSchema,
});

export const getOrganizerResponseSchema = z.object({
	success: z.literal(true),
	data: organizerProfileSchema,
});

export const organizerNotFoundResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export const organizerConflictResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export const organizerErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});

// ── Policy schemas ──────────────────────────────────────────────────

export const acceptPoliciesBodySchema = policyAcceptanceRequestSchema;

export const acceptPoliciesResponseSchema = z.object({
	success: z.literal(true),
	data: policyStatusResponseSchema,
});

export const getPoliciesResponseSchema = z.object({
	success: z.literal(true),
	data: policyStatusResponseSchema,
});

// ── Document upload schemas ─────────────────────────────────────────

export const documentUploadBodySchema = documentUploadRequestSchema;

export const documentUploadResponseSchema = z.object({
	success: z.literal(true),
	data: presignedUploadUrlSchema,
});

export const documentConfirmParamsSchema = z.object({
	documentId: z.string().uuid(),
});

export const documentConfirmResponseSchema = z.object({
	success: z.literal(true),
	data: verificationDocumentSchema,
});

export const documentListResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(verificationDocumentSchema),
});

export const documentDeleteParamsSchema = z.object({
	documentId: z.string().uuid(),
});

export const documentDeleteResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({ deleted: z.literal(true) }),
});

// ── Verification status schemas ─────────────────────────────────────

export const getVerificationStatusResponseSchema = z.object({
	success: z.literal(true),
	data: verificationStatusResponseSchema,
});
