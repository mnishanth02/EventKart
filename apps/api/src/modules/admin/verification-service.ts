import type { Database } from "@repo/db";
import { and, eq, inArray, sql } from "@repo/db";
import { auditLog, organizers, verificationDocuments } from "@repo/db/schema";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@repo/shared/constants";
import type { AdminVerificationListParams } from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { AppQueues } from "../../lib/queue.js";
import type { StorageClient } from "../../lib/storage.js";
import { getPolicyStatus } from "../organizer/policy-service.js";

const DOWNLOAD_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes

/**
 * List organizer verifications with offset pagination and optional status filter.
 * Sorted by submittedForReviewAt ASC NULLS LAST, id ASC (oldest first).
 */
export async function listVerifications(
	db: Database,
	params: AdminVerificationListParams,
) {
	const { page, limit, status } = params;
	const offset = (page - 1) * limit;

	// Build where condition
	const condition = status
		? eq(organizers.verificationStatus, status)
		: sql`1=1`;

	// Get total count
	const countRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(organizers)
		.where(condition);

	const total = countRows[0]?.total ?? 0;

	// Get paginated organizer rows
	const rows = await db
		.select({
			id: organizers.id,
			userId: organizers.userId,
			businessName: organizers.businessName,
			contactName: organizers.contactName,
			contactEmail: organizers.contactEmail,
			city: organizers.city,
			verificationStatus: organizers.verificationStatus,
			submittedForReviewAt: organizers.submittedForReviewAt,
			createdAt: organizers.createdAt,
		})
		.from(organizers)
		.where(condition)
		.orderBy(
			sql`${organizers.submittedForReviewAt} ASC NULLS LAST`,
			organizers.id,
		)
		.limit(limit)
		.offset(offset);

	// Fetch document counts for these organizers in a single query
	const organizerIds = rows.map((r) => r.id);
	const docCountMap = new Map<string, number>();
	if (organizerIds.length > 0) {
		const docCounts = await db
			.select({
				organizerId: verificationDocuments.organizerId,
				docCount: sql<number>`count(*)`,
			})
			.from(verificationDocuments)
			.where(
				and(
					inArray(verificationDocuments.organizerId, organizerIds),
					inArray(verificationDocuments.status, ["pending", "uploaded"]),
				),
			)
			.groupBy(verificationDocuments.organizerId);

		for (const d of docCounts) {
			docCountMap.set(d.organizerId, d.docCount);
		}
	}

	const totalPages = Math.ceil(total / limit);

	return {
		data: rows.map((row) => ({
			id: row.id,
			userId: row.userId,
			businessName: row.businessName,
			contactName: row.contactName,
			contactEmail: row.contactEmail,
			city: row.city,
			verificationStatus: row.verificationStatus,
			submittedForReviewAt: row.submittedForReviewAt?.toISOString() ?? null,
			documentCount: docCountMap.get(row.id) ?? 0,
			createdAt: row.createdAt.toISOString(),
		})),
		meta: {
			page,
			limit,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
}

/**
 * Get detailed verification information for a single organizer.
 * Includes organizer profile, documents, and policy status.
 */
export async function getVerificationDetail(db: Database, organizerId: string) {
	const orgs = await db
		.select()
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	const org = orgs[0];
	if (!org) {
		throw new NotFoundError("Organizer not found");
	}

	// Fetch active documents
	const docs = await db
		.select()
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.organizerId, organizerId),
				inArray(verificationDocuments.status, ["pending", "uploaded"]),
			),
		);

	// Fetch policy status
	const policyStatus = await getPolicyStatus(db, org.userId);

	return {
		organizer: {
			id: org.id,
			userId: org.userId,
			businessName: org.businessName,
			contactName: org.contactName,
			contactEmail: org.contactEmail,
			contactPhone: org.contactPhone,
			city: org.city,
			description: org.description,
			website: org.website,
			verificationStatus: org.verificationStatus,
			isVerified: org.isVerified,
			razorpayAccountStatus: org.razorpayAccountStatus,
			submittedForReviewAt: org.submittedForReviewAt?.toISOString() ?? null,
			reviewedAt: org.reviewedAt?.toISOString() ?? null,
			rejectionReason: org.rejectionReason,
			createdAt: org.createdAt.toISOString(),
			updatedAt: org.updatedAt.toISOString(),
		},
		documents: docs.map((doc) => ({
			id: doc.id,
			organizerId: doc.organizerId,
			documentType: doc.documentType,
			fileName: doc.fileName,
			contentType: doc.contentType,
			fileSize: doc.fileSize,
			status: doc.status,
			createdAt: doc.createdAt.toISOString(),
			updatedAt: doc.updatedAt.toISOString(),
		})),
		policiesAccepted: policyStatus.allRequiredAccepted,
		policyDetails: policyStatus.policies.map((p) => ({
			policyType: p.policyType,
			isAccepted: p.isCurrentVersionAccepted,
			acceptedAt: p.acceptedAt,
			version: p.acceptedVersion,
		})),
	};
}

/**
 * Generate a presigned download URL for a verification document.
 * Validates document ownership and looks up storageKey from DB.
 */
export async function getDocumentViewUrl(
	storage: StorageClient,
	db: Database,
	organizerId: string,
	documentId: string,
) {
	const docs = await db
		.select()
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.id, documentId),
				eq(verificationDocuments.organizerId, organizerId),
				eq(verificationDocuments.status, "uploaded"),
			),
		)
		.limit(1);

	const doc = docs[0];
	if (!doc) {
		throw new NotFoundError("Document not found");
	}

	const result = await storage.getDownloadUrl({
		key: doc.storageKey,
		expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
	});

	return {
		url: result.url,
		expiresAt: result.expiresAt.toISOString(),
		documentId: doc.id,
		documentType: doc.documentType,
		fileName: doc.fileName,
		contentType: doc.contentType,
	};
}

/**
 * Approve an organizer verification.
 * Uses a conditional UPDATE + audit log in a single transaction.
 */
export async function approveOrganizer(
	db: Database,
	log: FastifyBaseLogger,
	adminUserId: string,
	organizerId: string,
	ipAddress: string | null,
	notes?: string,
	queues?: AppQueues,
) {
	const now = new Date();

	const result = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(organizers)
			.set({
				verificationStatus: "approved",
				isVerified: true,
				reviewedAt: now,
				reviewedBy: adminUserId,
				razorpayAccountStatus: "not_started",
			})
			.where(
				and(
					eq(organizers.id, organizerId),
					eq(organizers.verificationStatus, "pending_review"),
				),
			)
			.returning({
				id: organizers.id,
				verificationStatus: organizers.verificationStatus,
				isVerified: organizers.isVerified,
				reviewedAt: organizers.reviewedAt,
				reviewedBy: organizers.reviewedBy,
			});

		if (!updated) {
			// Check if organizer exists at all
			const exists = await tx
				.select({ id: organizers.id })
				.from(organizers)
				.where(eq(organizers.id, organizerId))
				.limit(1);

			if (exists.length === 0) {
				throw new NotFoundError("Organizer not found");
			}
			throw new ConflictError("Organizer is not in pending_review status");
		}

		// Write audit log in the same transaction
		await tx.insert(auditLog).values({
			actorId: adminUserId,
			actorRole: "admin",
			action: AUDIT_ACTIONS.ORGANIZER_APPROVE,
			resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
			resourceId: organizerId,
			metadata: notes ? { notes } : null,
			ipAddress,
		});

		log.info({ organizerId, adminUserId }, "Organizer approved");

		const reviewedAt = updated.reviewedAt ?? now;
		const reviewedBy = updated.reviewedBy ?? adminUserId;

		return {
			organizerId: updated.id,
			verificationStatus: updated.verificationStatus,
			isVerified: updated.isVerified,
			reviewedAt: reviewedAt.toISOString(),
			reviewedBy,
		};
	});

	// Enqueue Razorpay linked account creation (outside transaction)
	if (queues) {
		try {
			await queues.razorpayAccount.add(
				"create-linked-account",
				{ organizerId },
				{ jobId: `razorpay-${organizerId}` },
			);
			log.info({ organizerId }, "Razorpay account creation job enqueued");
		} catch (enqueueError) {
			// Don't fail the approval — just log
			log.error(
				{ organizerId, error: enqueueError },
				"Failed to enqueue Razorpay account creation job",
			);
		}
	}

	return result;
}

/**
 * Reject an organizer verification.
 * Uses a conditional UPDATE + audit log in a single transaction.
 */
export async function rejectOrganizer(
	db: Database,
	log: FastifyBaseLogger,
	adminUserId: string,
	organizerId: string,
	reason: string,
	ipAddress: string | null,
) {
	const now = new Date();

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(organizers)
			.set({
				verificationStatus: "rejected",
				isVerified: false,
				reviewedAt: now,
				reviewedBy: adminUserId,
				rejectionReason: reason,
			})
			.where(
				and(
					eq(organizers.id, organizerId),
					eq(organizers.verificationStatus, "pending_review"),
				),
			)
			.returning({
				id: organizers.id,
				verificationStatus: organizers.verificationStatus,
				isVerified: organizers.isVerified,
				reviewedAt: organizers.reviewedAt,
				reviewedBy: organizers.reviewedBy,
			});

		if (!updated) {
			const exists = await tx
				.select({ id: organizers.id })
				.from(organizers)
				.where(eq(organizers.id, organizerId))
				.limit(1);

			if (exists.length === 0) {
				throw new NotFoundError("Organizer not found");
			}
			throw new ConflictError("Organizer is not in pending_review status");
		}

		// Write audit log in the same transaction
		await tx.insert(auditLog).values({
			actorId: adminUserId,
			actorRole: "admin",
			action: AUDIT_ACTIONS.ORGANIZER_REJECT,
			resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
			resourceId: organizerId,
			metadata: { reason },
			ipAddress,
		});

		log.info({ organizerId, adminUserId, reason }, "Organizer rejected");

		const reviewedAt = updated.reviewedAt ?? now;
		const reviewedBy = updated.reviewedBy ?? adminUserId;

		return {
			organizerId: updated.id,
			verificationStatus: updated.verificationStatus,
			isVerified: updated.isVerified,
			reviewedAt: reviewedAt.toISOString(),
			reviewedBy,
		};
	});
}

/**
 * Retry Razorpay linked account creation for an organizer
 * in a retryable state (not_started, failed, needs_action).
 */
export async function retryRazorpayAccount(
	db: Database,
	log: FastifyBaseLogger,
	organizerId: string,
	queues: AppQueues,
	adminUserId: string,
	ipAddress: string | null,
) {
	const orgs = await db
		.select({
			id: organizers.id,
			razorpayAccountStatus: organizers.razorpayAccountStatus,
		})
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	const org = orgs[0];
	if (!org) {
		throw new NotFoundError("Organizer not found");
	}

	const RETRYABLE: string[] = ["not_started", "failed", "needs_action"];
	if (!RETRYABLE.includes(org.razorpayAccountStatus)) {
		throw new ConflictError(
			`Cannot retry Razorpay account creation — current status is "${org.razorpayAccountStatus}"`,
		);
	}

	await queues.razorpayAccount.add(
		"create-linked-account",
		{ organizerId },
		{ jobId: `razorpay-${organizerId}-${Date.now()}` },
	);

	// Audit log the retry action
	await db.insert(auditLog).values({
		actorId: adminUserId,
		actorRole: "admin",
		action: AUDIT_ACTIONS.RAZORPAY_ACCOUNT_RETRY,
		resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
		resourceId: organizerId,
		metadata: { previousStatus: org.razorpayAccountStatus },
		ipAddress,
	});

	log.info(
		{ organizerId, adminUserId },
		"Razorpay account retry job enqueued by admin",
	);

	return {
		organizerId,
		razorpayAccountStatus: org.razorpayAccountStatus,
		message: "Razorpay account creation retry has been enqueued",
	};
}
