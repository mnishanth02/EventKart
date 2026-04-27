import { and, type Database, eq, inArray, ne } from "@repo/db";
import { eventImages, events } from "@repo/db/schema";
import {
	AUDIT_ACTIONS,
	AUDIT_RESOURCE_TYPES,
	type EventImageStatus,
} from "@repo/shared/constants";
import type {
	EventImage,
	EventImageListQuery,
	EventImageUploadUrlRequest,
} from "@repo/shared/schemas";
import {
	eventImageSchema,
	eventImageUploadUrlRequestSchema,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { AuditLogger } from "../../lib/audit.js";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../lib/errors.js";
import type { StorageClient } from "../../lib/storage.js";
import { MAX_FILE_SIZES } from "../../lib/storage.js";
import { getOrganizerByUserId } from "../organizer/service.js";

export interface EventImageServiceDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	storage: StorageClient;
	auditLogger: AuditLogger;
}

type EventImageRow = typeof eventImages.$inferSelect;
type EventStatusValue = (typeof events.$inferSelect)["status"];

function contentTypeToExtension(contentType: string): string {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
	};
	return map[contentType] ?? "bin";
}

function toEventImageResponse(row: EventImageRow): EventImage {
	return eventImageSchema.parse({
		id: row.id,
		eventId: row.eventId,
		kind: row.kind,
		fileName: row.fileName,
		contentType: row.contentType,
		sizeBytes: row.sizeBytes,
		storageKey: row.storageKey,
		status: row.status,
		uploadedBy: row.uploadedBy,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	});
}

function isPubliclyReadableEventStatus(status: EventStatusValue): boolean {
	return status === "published" || status === "completed";
}

async function getOrganizerForUser(db: Database, userId: string) {
	const organizer = await getOrganizerByUserId(db, userId);
	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}
	return organizer;
}

async function assertWritableEvent(
	db: Database,
	userId: string,
	eventId: string,
) {
	const organizer = await getOrganizerForUser(db, userId);
	const [event] = await db
		.select({
			id: events.id,
			organizerId: events.organizerId,
			status: events.status,
		})
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	if (event.organizerId !== organizer.id) {
		throw new ForbiddenError("You do not have access to this event");
	}

	return { event, organizer };
}

async function assertEventReadable(
	db: Database,
	eventId: string,
	userId?: string,
) {
	const [event] = await db
		.select({
			id: events.id,
			organizerId: events.organizerId,
			status: events.status,
		})
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	if (userId) {
		const organizer = await getOrganizerByUserId(db, userId);
		if (organizer?.id === event.organizerId) {
			return { event, ownerRead: true };
		}
	}

	if (isPubliclyReadableEventStatus(event.status)) {
		return { event, ownerRead: false };
	}

	throw new NotFoundError("Event not found");
}

export async function requestEventImageUpload(
	deps: EventImageServiceDeps,
	userId: string,
	eventId: string,
	body: EventImageUploadUrlRequest,
	ipAddress?: string,
) {
	if (!deps.storage.enabled) {
		throw new ValidationError(
			"Event image upload is not available at this time",
		);
	}

	const parsed = eventImageUploadUrlRequestSchema.safeParse(body);
	if (!parsed.success) {
		throw new ValidationError("Invalid event image upload request", {
			issues: parsed.error.issues.map((issue) => ({
				code: issue.code,
				message: issue.message,
				path: issue.path.map(String),
			})),
		});
	}

	const { organizer } = await assertWritableEvent(deps.db, userId, eventId);
	const data = parsed.data;
	const uploadResult = await deps.storage.getUploadUrl({
		category: "event-image",
		ownerId: eventId,
		extension: contentTypeToExtension(data.contentType),
		contentType: data.contentType,
	});

	const [image] = await deps.db
		.insert(eventImages)
		.values({
			eventId,
			kind: data.kind,
			fileName: data.fileName,
			contentType: data.contentType,
			sizeBytes: data.sizeBytes,
			storageKey: uploadResult.key,
			status: "pending",
			uploadedBy: userId,
		})
		.returning();

	if (!image) {
		throw new Error("Failed to insert event image record");
	}

	deps.log.info(
		{ eventId, imageId: image.id, kind: image.kind, organizerId: organizer.id },
		"Event image upload requested",
	);

	void deps.auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.EVENT_IMAGE_UPLOAD_REQUEST,
		resourceType: AUDIT_RESOURCE_TYPES.EVENT,
		resourceId: eventId,
		metadata: {
			imageId: image.id,
			kind: image.kind,
			storageKey: image.storageKey,
		},
		ipAddress,
	});

	return {
		imageId: image.id,
		url: uploadResult.url,
		method: uploadResult.method,
		headers: uploadResult.headers,
		key: uploadResult.key,
		expiresAt: uploadResult.expiresAt.toISOString(),
	};
}

export async function confirmEventImageUpload(
	deps: EventImageServiceDeps,
	userId: string,
	eventId: string,
	imageId: string,
	ipAddress?: string,
): Promise<EventImage> {
	if (!deps.storage.enabled) {
		throw new ValidationError(
			"Event image upload is not available at this time",
		);
	}

	const { organizer } = await assertWritableEvent(deps.db, userId, eventId);
	const [image] = await deps.db
		.select()
		.from(eventImages)
		.where(
			and(
				eq(eventImages.id, imageId),
				eq(eventImages.eventId, eventId),
				eq(eventImages.status, "pending"),
			),
		)
		.limit(1);

	if (!image) {
		throw new NotFoundError("Event image not found or already confirmed");
	}

	const metadata = await deps.storage.headObject(image.storageKey);
	if (!metadata) {
		throw new ValidationError(
			"Upload not found. Please try uploading the file again.",
		);
	}

	const maxSize = MAX_FILE_SIZES["event-image"];
	if (metadata.contentLength == null) {
		throw new ValidationError("Upload metadata is missing file size");
	}

	if (metadata.contentLength > maxSize) {
		await deps.storage.deleteObject(image.storageKey);
		await deps.db
			.update(eventImages)
			.set({ status: "deleted", updatedAt: new Date() })
			.where(eq(eventImages.id, imageId));

		throw new ValidationError(
			`File size ${Math.round((metadata.contentLength / 1024 / 1024) * 10) / 10}MB exceeds maximum of ${maxSize / 1024 / 1024}MB`,
		);
	}

	let updated!: EventImageRow;
	await deps.db.transaction(async (tx) => {
		await tx
			.update(eventImages)
			.set({ status: "replaced", updatedAt: new Date() })
			.where(
				and(
					eq(eventImages.eventId, eventId),
					eq(eventImages.kind, image.kind),
					inArray(eventImages.status, ["pending", "uploaded"]),
					ne(eventImages.id, imageId),
				),
			);

		const [result] = await tx
			.update(eventImages)
			.set({
				status: "uploaded",
				sizeBytes: metadata.contentLength,
				updatedAt: new Date(),
			})
			.where(eq(eventImages.id, imageId))
			.returning();

		if (!result) {
			throw new Error("Failed to update event image status");
		}

		updated = result;
	});

	deps.log.info(
		{
			eventId,
			imageId,
			kind: image.kind,
			fileSize: metadata.contentLength,
			organizerId: organizer.id,
		},
		"Event image upload confirmed",
	);

	void deps.auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.EVENT_IMAGE_UPLOAD_CONFIRM,
		resourceType: AUDIT_RESOURCE_TYPES.EVENT,
		resourceId: eventId,
		metadata: {
			imageId,
			kind: image.kind,
			storageKey: image.storageKey,
			fileSize: metadata.contentLength,
		},
		ipAddress,
	});

	return toEventImageResponse(updated);
}

export async function listEventImages(
	db: Database,
	eventId: string,
	query: EventImageListQuery = {},
	userId?: string,
): Promise<EventImage[]> {
	const { ownerRead } = await assertEventReadable(db, eventId, userId);
	let visibleStatuses: EventImageStatus[];
	if (ownerRead) {
		visibleStatuses = query.status
			? query.status === "deleted"
				? []
				: [query.status]
			: ["pending", "uploaded"];
	} else {
		visibleStatuses =
			query.status && query.status !== "uploaded" ? [] : ["uploaded"];
	}

	if (visibleStatuses.length === 0) {
		return [];
	}

	const filters = [
		eq(eventImages.eventId, eventId),
		inArray(eventImages.status, visibleStatuses),
	];

	if (query.kind) {
		filters.push(eq(eventImages.kind, query.kind));
	}

	const rows = await db
		.select()
		.from(eventImages)
		.where(and(...filters))
		.orderBy(eventImages.createdAt);

	return rows.map(toEventImageResponse);
}

export async function deleteEventImage(
	deps: EventImageServiceDeps,
	userId: string,
	eventId: string,
	imageId: string,
	ipAddress?: string,
) {
	if (!deps.storage.enabled) {
		throw new ValidationError(
			"Event image upload is not available at this time",
		);
	}

	const { organizer } = await assertWritableEvent(deps.db, userId, eventId);
	const [image] = await deps.db
		.select()
		.from(eventImages)
		.where(
			and(
				eq(eventImages.id, imageId),
				eq(eventImages.eventId, eventId),
				inArray(eventImages.status, ["pending", "uploaded"]),
			),
		)
		.limit(1);

	if (!image) {
		throw new NotFoundError("Event image not found");
	}

	try {
		await deps.storage.deleteObject(image.storageKey);
	} catch (err) {
		deps.log.warn(
			{ err, eventId, imageId, storageKey: image.storageKey },
			"Failed to delete event image object from storage",
		);
	}

	await deps.db
		.update(eventImages)
		.set({ status: "deleted", updatedAt: new Date() })
		.where(eq(eventImages.id, imageId));

	deps.log.info(
		{ eventId, imageId, kind: image.kind, organizerId: organizer.id },
		"Event image deleted",
	);

	void deps.auditLogger.log({
		actorId: userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.EVENT_IMAGE_DELETE,
		resourceType: AUDIT_RESOURCE_TYPES.EVENT,
		resourceId: eventId,
		metadata: {
			imageId,
			kind: image.kind,
			storageKey: image.storageKey,
		},
		ipAddress,
	});

	return { deleted: true as const, imageId, kind: image.kind };
}
