import type { FastifyBaseLogger } from "fastify";
import type { Database } from "@repo/db";
import type { StorageClient } from "../../lib/storage.js";
import type { AuditLogger } from "../../lib/audit.js";
import type { DocumentUploadRequest } from "@repo/shared/schemas";
import { verificationDocuments, organizers } from "@repo/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { MAX_FILE_SIZES } from "../../lib/storage.js";
import {
	AUDIT_ACTIONS,
	AUDIT_RESOURCE_TYPES,
	REQUIRED_DOCUMENT_COUNT,
} from "@repo/shared/constants";

export interface DocumentServiceDeps {
	db: Database;
	log: FastifyBaseLogger;
	storage: StorageClient;
	auditLogger: AuditLogger;
}

function contentTypeToExtension(contentType: string): string {
	const map: Record<string, string> = {
		"application/pdf": "pdf",
		"image/jpeg": "jpg",
		"image/png": "png",
	};
	return map[contentType] ?? "bin";
}

function toDocumentResponse(row: typeof verificationDocuments.$inferSelect) {
	return {
		id: row.id,
		organizerId: row.organizerId,
		documentType: row.documentType,
		fileName: row.fileName,
		contentType: row.contentType,
		fileSize: row.fileSize,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/**
 * Request a presigned upload URL for a verification document.
 * Creates a pending record in the database.
 */
export async function requestDocumentUpload(
	deps: DocumentServiceDeps,
	organizerId: string,
	userId: string,
	data: DocumentUploadRequest,
	ipAddress: string,
) {
	const { db, log, storage, auditLogger } = deps;

	const extension = contentTypeToExtension(data.contentType);
	const uploadResult = await storage.getUploadUrl({
		category: "kyc",
		ownerId: organizerId,
		extension,
		contentType: data.contentType,
	});

	const [doc] = await db
		.insert(verificationDocuments)
		.values({
			organizerId,
			documentType: data.documentType,
			storageKey: uploadResult.key,
			fileName: data.fileName,
			contentType: data.contentType,
			status: "pending",
			uploadedBy: userId,
		})
		.returning();

	if (!doc) {
		throw new Error("Failed to insert verification document record");
	}

	log.info(
		{ documentId: doc.id, organizerId, documentType: data.documentType },
		"Verification document upload requested",
	);

	void auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.ORGANIZER_DOCUMENT_UPLOAD,
		resourceType: AUDIT_RESOURCE_TYPES.DOCUMENT,
		resourceId: doc.id,
		metadata: {
			documentType: data.documentType,
			contentType: data.contentType,
		},
		ipAddress,
	});

	return {
		documentId: doc.id,
		url: uploadResult.url,
		method: uploadResult.method,
		headers: uploadResult.headers,
		key: uploadResult.key,
		expiresAt: uploadResult.expiresAt.toISOString(),
	};
}

/**
 * Confirm that a document has been successfully uploaded to S3.
 * Verifies the object exists and checks size limits.
 * Marks any previously active document of the same type as "replaced".
 * Updates organizer verification status if all required docs are now uploaded.
 */
export async function confirmDocumentUpload(
	deps: DocumentServiceDeps,
	organizerId: string,
	userId: string,
	documentId: string,
	ipAddress: string,
) {
	const { db, log, storage, auditLogger } = deps;

	const docs = await db
		.select()
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.id, documentId),
				eq(verificationDocuments.organizerId, organizerId),
				eq(verificationDocuments.status, "pending"),
			),
		)
		.limit(1);

	const doc = docs[0];
	if (!doc) {
		throw new NotFoundError("Document not found or already confirmed");
	}

	const metadata = await storage.headObject(doc.storageKey);
	if (!metadata) {
		throw new ValidationError(
			"Upload not found. Please try uploading the file again.",
		);
	}

	const maxSize = MAX_FILE_SIZES.kyc;
	if (metadata.contentLength != null && metadata.contentLength > maxSize) {
		await storage.deleteObject(doc.storageKey);
		await db
			.update(verificationDocuments)
			.set({ status: "deleted" })
			.where(eq(verificationDocuments.id, documentId));

		throw new ValidationError(
			`File size ${Math.round((metadata.contentLength / 1024 / 1024) * 10) / 10}MB exceeds maximum of ${maxSize / 1024 / 1024}MB`,
		);
	}

	// Mark any previously uploaded doc of the same type as "replaced"
	await db
		.update(verificationDocuments)
		.set({ status: "replaced" })
		.where(
			and(
				eq(verificationDocuments.organizerId, organizerId),
				eq(verificationDocuments.documentType, doc.documentType),
				eq(verificationDocuments.status, "uploaded"),
			),
		);

	const [updated] = await db
		.update(verificationDocuments)
		.set({
			status: "uploaded",
			fileSize: metadata.contentLength ?? null,
		})
		.where(eq(verificationDocuments.id, documentId))
		.returning();

	if (!updated) {
		throw new Error("Failed to update document status");
	}

	await maybeUpdateOrganizerVerificationStatus(db, organizerId, log);

	log.info(
		{
			documentId,
			organizerId,
			documentType: doc.documentType,
			fileSize: metadata.contentLength,
		},
		"Verification document upload confirmed",
	);

	void auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.ORGANIZER_DOCUMENT_CONFIRM,
		resourceType: AUDIT_RESOURCE_TYPES.DOCUMENT,
		resourceId: documentId,
		metadata: {
			documentType: doc.documentType,
			fileSize: metadata.contentLength,
		},
		ipAddress,
	});

	return toDocumentResponse(updated);
}

/**
 * List all active (non-deleted, non-replaced) documents for an organizer.
 */
export async function listVerificationDocuments(
	db: Database,
	organizerId: string,
) {
	const docs = await db
		.select()
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.organizerId, organizerId),
				inArray(verificationDocuments.status, ["pending", "uploaded"]),
			),
		);

	return docs.map(toDocumentResponse);
}

/**
 * Delete a verification document. Removes from S3 and marks as deleted in DB.
 * Reverts organizer verification status if a required doc is now missing.
 */
export async function deleteVerificationDocument(
	deps: DocumentServiceDeps,
	organizerId: string,
	userId: string,
	documentId: string,
	ipAddress: string,
) {
	const { db, log, storage, auditLogger } = deps;

	const docs = await db
		.select()
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.id, documentId),
				eq(verificationDocuments.organizerId, organizerId),
				inArray(verificationDocuments.status, ["pending", "uploaded"]),
			),
		)
		.limit(1);

	const doc = docs[0];
	if (!doc) {
		throw new NotFoundError("Document not found");
	}

	try {
		await storage.deleteObject(doc.storageKey);
	} catch (err) {
		log.warn(
			{ err, storageKey: doc.storageKey },
			"Failed to delete object from storage",
		);
	}

	await db
		.update(verificationDocuments)
		.set({ status: "deleted" })
		.where(eq(verificationDocuments.id, documentId));

	await maybeUpdateOrganizerVerificationStatus(db, organizerId, log);

	log.info(
		{ documentId, organizerId, documentType: doc.documentType },
		"Verification document deleted",
	);

	void auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.ORGANIZER_DOCUMENT_DELETE,
		resourceType: AUDIT_RESOURCE_TYPES.DOCUMENT,
		resourceId: documentId,
		metadata: { documentType: doc.documentType },
		ipAddress,
	});
}

/**
 * Update organizer's verificationStatus based on uploaded document count.
 * - All required types uploaded → "pending_review"
 * - Missing types and was "pending_review" → "pending_documents"
 * - Was "rejected" and all docs re-uploaded → "pending_review"
 * - Status "approved" is never changed.
 */
async function maybeUpdateOrganizerVerificationStatus(
	db: Database,
	organizerId: string,
	log: FastifyBaseLogger,
) {
	const uploadedDocs = await db
		.select({ documentType: verificationDocuments.documentType })
		.from(verificationDocuments)
		.where(
			and(
				eq(verificationDocuments.organizerId, organizerId),
				eq(verificationDocuments.status, "uploaded"),
			),
		);

	const uploadedTypes = new Set(uploadedDocs.map((d) => d.documentType));
	const allDocsUploaded = uploadedTypes.size >= REQUIRED_DOCUMENT_COUNT;

	const orgs = await db
		.select({ verificationStatus: organizers.verificationStatus })
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	const org = orgs[0];
	if (!org) return;

	const currentStatus = org.verificationStatus;

	if (currentStatus === "approved") return;

	let newStatus: typeof currentStatus | null = null;

	if (
		allDocsUploaded &&
		(currentStatus === "pending_documents" || currentStatus === "rejected")
	) {
		newStatus = "pending_review";
	} else if (!allDocsUploaded && currentStatus === "pending_review") {
		newStatus = "pending_documents";
	}

	if (newStatus && newStatus !== currentStatus) {
		await db
			.update(organizers)
			.set({ verificationStatus: newStatus })
			.where(eq(organizers.id, organizerId));

		log.info(
			{ organizerId, from: currentStatus, to: newStatus },
			"Organizer verification status updated",
		);
	}
}
