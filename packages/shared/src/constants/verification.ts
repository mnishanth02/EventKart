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
