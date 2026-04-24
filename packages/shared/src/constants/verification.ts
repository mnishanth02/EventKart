import { z } from "zod/v4";

export const VERIFICATION_STATUSES = [
	"pending_documents",
	"pending_review",
	"approved",
	"rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);

/** Human-readable labels for verification statuses. */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
	pending_documents: "Pending Documents",
	pending_review: "Pending Review",
	approved: "Approved",
	rejected: "Rejected",
} as const;

/** Document types required for organizer verification (KYC). */
export const VERIFICATION_DOCUMENT_TYPES = [
	"aadhaar",
	"pan",
	"gst_certificate",
	"bank_proof",
] as const;

export type VerificationDocumentType =
	(typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const verificationDocumentTypeSchema = z.enum(
	VERIFICATION_DOCUMENT_TYPES,
);

/** Human-readable labels for document types. */
export const VERIFICATION_DOCUMENT_TYPE_LABELS: Record<
	VerificationDocumentType,
	string
> = {
	aadhaar: "Aadhaar Card",
	pan: "PAN Card",
	gst_certificate: "GST Certificate",
	bank_proof: "Bank Proof",
} as const;

/** Status of an individual verification document. */
export const DOCUMENT_STATUSES = [
	"pending",
	"uploaded",
	"replaced",
	"deleted",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

/** Total number of required document types for complete submission. */
export const REQUIRED_DOCUMENT_COUNT = VERIFICATION_DOCUMENT_TYPES.length;
