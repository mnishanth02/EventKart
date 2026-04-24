import type { Database } from "@repo/db";
import { organizers, verificationDocuments } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import {
	REQUIRED_DOCUMENT_COUNT,
	VERIFICATION_DOCUMENT_TYPES,
	VERIFICATION_DOCUMENT_TYPE_LABELS,
	VERIFICATION_SLA_BUSINESS_DAYS,
} from "@repo/shared/constants";
import type { VerificationStatusResponse } from "@repo/shared/schemas";
import { getPolicyStatus } from "./policy-service.js";

/**
 * Add business days to a date (skipping Sat/Sun).
 * Does not account for regional holidays — acceptable for V1.
 */
function addBusinessDays(date: Date, days: number): Date {
	const result = new Date(date);
	let added = 0;
	while (added < days) {
		result.setDate(result.getDate() + 1);
		const dayOfWeek = result.getDay();
		if (dayOfWeek !== 0 && dayOfWeek !== 6) {
			added++;
		}
	}
	return result;
}

/**
 * Get comprehensive verification status for an organizer.
 * Aggregates registration, policy, document, and review information
 * into a single response for the status tracking dashboard.
 */
export async function getVerificationStatus(
	db: Database,
	userId: string,
	organizerId: string,
): Promise<VerificationStatusResponse> {
	// Fetch organizer row
	const orgs = await db
		.select()
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	const org = orgs[0];
	if (!org) {
		throw new Error("Organizer not found");
	}

	// Fetch uploaded documents
	const uploadedDocs = await db
		.select({
			documentType: verificationDocuments.documentType,
		})
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.organizerId, organizerId),
				eq(verificationDocuments.status, "uploaded"),
			),
		);

	const uploadedTypes = new Set(uploadedDocs.map((d) => d.documentType));

	// Fetch policy status
	const policyStatus = await getPolicyStatus(db, userId);

	// Compute document progress
	const uploaded = VERIFICATION_DOCUMENT_TYPES.filter((t) =>
		uploadedTypes.has(t),
	);
	const missing = VERIFICATION_DOCUMENT_TYPES.filter(
		(t) => !uploadedTypes.has(t),
	);
	const allDocsUploaded = uploaded.length >= REQUIRED_DOCUMENT_COUNT;

	// Compute policy progress
	const acceptedPolicies = policyStatus.policies
		.filter((p) => p.isCurrentVersionAccepted)
		.map((p) => p.policyType);
	const missingPolicies = policyStatus.policies
		.filter((p) => !p.isCurrentVersionAccepted)
		.map((p) => p.policyType);

	// Compute SLA dates
	const submittedAt = org.submittedForReviewAt?.toISOString() ?? null;
	let expectedBy: string | null = null;
	if (org.submittedForReviewAt) {
		expectedBy = addBusinessDays(
			org.submittedForReviewAt,
			VERIFICATION_SLA_BUSINESS_DAYS,
		).toISOString();
	}

	// Determine review step status
	let reviewStatus: "not_ready" | "pending" | "approved" | "rejected";
	switch (org.verificationStatus) {
		case "approved":
			reviewStatus = "approved";
			break;
		case "rejected":
			reviewStatus = "rejected";
			break;
		case "pending_review":
			reviewStatus = "pending";
			break;
		default:
			reviewStatus = "not_ready";
	}

	return {
		verificationStatus: org.verificationStatus,
		isVerified: org.isVerified,
		submittedForReviewAt: submittedAt,
		reviewedAt: org.reviewedAt?.toISOString() ?? null,
		expectedReviewBy: expectedBy,
		rejectionReason: org.rejectionReason,
		steps: {
			registration: { completed: true },
			policies: {
				completed: policyStatus.allRequiredAccepted,
				accepted: acceptedPolicies,
				missing: missingPolicies,
			},
			documents: {
				completed: allDocsUploaded,
				uploaded: [...uploaded],
				missing: [...missing],
				total: REQUIRED_DOCUMENT_COUNT,
				uploadedCount: uploaded.length,
			},
			review: {
				status: reviewStatus,
				submittedAt,
				expectedBy,
			},
		},
	};
}
