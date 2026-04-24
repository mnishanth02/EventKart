import { z } from "zod/v4";
import {
	documentStatusSchema,
	verificationDocumentTypeSchema,
} from "../constants/verification.js";
import { emailSchema } from "./email.js";
import { phoneSchema } from "./phone.js";

/**
 * Organizer registration request — submitted when an organizer-role user
 * creates their organizer profile for the first time.
 *
 * City is a free-form string (Coimbatore-only for V1, but no enum lock).
 */
export const organizerRegistrationSchema = z.object({
	businessName: z
		.string()
		.min(2, "Business name must be at least 2 characters")
		.max(200, "Business name must not exceed 200 characters")
		.trim(),
	contactName: z
		.string()
		.min(2, "Contact name must be at least 2 characters")
		.max(100, "Contact name must not exceed 100 characters")
		.trim(),
	contactEmail: emailSchema,
	contactPhone: phoneSchema,
	city: z
		.string()
		.min(2, "City must be at least 2 characters")
		.max(100, "City must not exceed 100 characters")
		.trim(),
	description: z
		.string()
		.max(2000, "Description must not exceed 2000 characters")
		.trim()
		.optional(),
	website: z
		.string()
		.url("Must be a valid URL")
		.max(500, "Website URL must not exceed 500 characters")
		.optional(),
});

export type OrganizerRegistrationInput = z.input<
	typeof organizerRegistrationSchema
>;
export type OrganizerRegistration = z.output<
	typeof organizerRegistrationSchema
>;

/**
 * Organizer profile update — partial update of editable profile fields.
 * All fields are optional, but at least one must be provided.
 *
 * Use `organizerUpdateBaseSchema` for route body validation (Fastify type provider
 * compatible) and validate the "at least one field" constraint in the handler.
 */
export const organizerUpdateBaseSchema = z.object({
	businessName: z
		.string()
		.min(2, "Business name must be at least 2 characters")
		.max(200, "Business name must not exceed 200 characters")
		.trim()
		.optional(),
	contactName: z
		.string()
		.min(2, "Contact name must be at least 2 characters")
		.max(100, "Contact name must not exceed 100 characters")
		.trim()
		.optional(),
	contactEmail: emailSchema.optional(),
	contactPhone: phoneSchema.optional(),
	city: z
		.string()
		.min(2, "City must be at least 2 characters")
		.max(100, "City must not exceed 100 characters")
		.trim()
		.optional(),
	description: z
		.string()
		.max(2000, "Description must not exceed 2000 characters")
		.trim()
		.optional(),
	website: z
		.string()
		.url("Must be a valid URL")
		.max(500, "Website URL must not exceed 500 characters")
		.optional(),
});

export const organizerUpdateSchema = organizerUpdateBaseSchema.refine(
	(val) => Object.values(val).some((v) => v !== undefined),
	"At least one field must be provided for update",
);

export type OrganizerUpdateInput = z.input<typeof organizerUpdateBaseSchema>;
export type OrganizerUpdate = z.output<typeof organizerUpdateBaseSchema>;

/** Public-safe organizer data (excludes internal fields). */
export const organizerProfileSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	businessName: z.string(),
	contactName: z.string(),
	contactEmail: z.string(),
	contactPhone: z.string(),
	city: z.string(),
	description: z.string().nullable(),
	website: z.string().nullable(),
	verificationStatus: z.string(),
	isVerified: z.boolean(),
	submittedForReviewAt: z.string().nullable(),
	reviewedAt: z.string().nullable(),
	rejectionReason: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type OrganizerProfile = z.infer<typeof organizerProfileSchema>;

// ── Verification document schemas ─────────────────────────────────

/** Allowed file extensions for KYC uploads. */
export const ALLOWED_KYC_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

/** Allowed MIME types for KYC uploads. */
export const ALLOWED_KYC_CONTENT_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
] as const;

/** Request to get a presigned upload URL for a verification document. */
export const documentUploadRequestSchema = z.object({
	documentType: verificationDocumentTypeSchema,
	fileName: z.string().min(1).max(255).trim(),
	contentType: z.enum(ALLOWED_KYC_CONTENT_TYPES),
});

export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;

/** Response containing a presigned upload URL. */
export const presignedUploadUrlSchema = z.object({
	documentId: z.string().uuid(),
	url: z.string().url(),
	method: z.literal("PUT"),
	headers: z.record(z.string(), z.string()),
	key: z.string(),
	expiresAt: z.string(),
});

export type PresignedUploadUrl = z.infer<typeof presignedUploadUrlSchema>;

/** A verification document record (as returned by the API). */
export const verificationDocumentSchema = z.object({
	id: z.string().uuid(),
	organizerId: z.string().uuid(),
	documentType: verificationDocumentTypeSchema,
	fileName: z.string(),
	contentType: z.string(),
	fileSize: z.number().nullable(),
	status: documentStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type VerificationDocument = z.infer<typeof verificationDocumentSchema>;

// ── Verification status tracking schemas ──────────────────────────

/** Document progress for a single document type. */
export const documentProgressItemSchema = z.object({
	documentType: verificationDocumentTypeSchema,
	label: z.string(),
	uploaded: z.boolean(),
});

/** Comprehensive verification status response. */
export const verificationStatusResponseSchema = z.object({
	verificationStatus: z.string(),
	isVerified: z.boolean(),
	submittedForReviewAt: z.string().nullable(),
	reviewedAt: z.string().nullable(),
	expectedReviewBy: z.string().nullable(),
	rejectionReason: z.string().nullable(),
	steps: z.object({
		registration: z.object({ completed: z.boolean() }),
		policies: z.object({
			completed: z.boolean(),
			accepted: z.array(z.string()),
			missing: z.array(z.string()),
		}),
		documents: z.object({
			completed: z.boolean(),
			uploaded: z.array(verificationDocumentTypeSchema),
			missing: z.array(verificationDocumentTypeSchema),
			total: z.number(),
			uploadedCount: z.number(),
		}),
		review: z.object({
			status: z.enum(["not_ready", "pending", "approved", "rejected"]),
			submittedAt: z.string().nullable(),
			expectedBy: z.string().nullable(),
		}),
	}),
});

export type VerificationStatusResponse = z.infer<
	typeof verificationStatusResponseSchema
>;

export type DocumentProgressItem = z.infer<typeof documentProgressItemSchema>;
