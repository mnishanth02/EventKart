import type { Database } from "@repo/db";
import { AUDIT_ACTIONS } from "@repo/shared/constants";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogger } from "../../../src/lib/audit.js";
import { ForbiddenError, ValidationError } from "../../../src/lib/errors.js";
import type { StorageClient } from "../../../src/lib/storage.js";
import { MAX_FILE_SIZES } from "../../../src/lib/storage.js";
import {
	confirmEventImageUpload,
	deleteEventImage,
	listEventImages,
	requestEventImageUpload,
} from "../../../src/modules/events/event-image-service.js";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "12121212-1212-4121-8121-121212121212";
const ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const OTHER_ORGANIZER_ID = "770e8400-e29b-41d4-a716-446655440002";
const CREATED_AT = new Date("2026-04-26T12:00:00.000Z");
const UPDATED_AT = new Date("2026-04-26T12:01:00.000Z");

type SelectRows = Record<string, unknown>[];

function createSelectQuery(rows: SelectRows) {
	const query = {
		from: vi.fn(),
		limit: vi.fn(),
		orderBy: vi.fn(),
		where: vi.fn(),
	};

	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.limit.mockResolvedValue(rows);
	query.orderBy.mockResolvedValue(rows);

	return query;
}

function createMockDb({
	selectRows,
	insertRows = [],
	updateRows = [],
}: {
	selectRows: SelectRows[];
	insertRows?: SelectRows;
	updateRows?: SelectRows[];
}) {
	const pendingSelectRows = [...selectRows];
	const pendingUpdateRows = [...updateRows];
	const updateSets: Record<string, unknown>[] = [];
	const selectQueries: ReturnType<typeof createSelectQuery>[] = [];

	const select = vi.fn(() => {
		const query = createSelectQuery(pendingSelectRows.shift() ?? []);
		selectQueries.push(query);
		return query;
	});

	const insertReturning = vi.fn().mockResolvedValue(insertRows);
	const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
	const insert = vi.fn().mockReturnValue({ values: insertValues });

	const updateReturning = vi.fn(() =>
		Promise.resolve(pendingUpdateRows.shift() ?? []),
	);
	const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
	const updateSet = vi.fn((values: Record<string, unknown>) => {
		updateSets.push(values);
		return { where: updateWhere };
	});
	const update = vi.fn().mockReturnValue({ set: updateSet });

	let db: Database;
	const transaction = vi.fn(
		async (callback: (tx: Database) => Promise<unknown>) => callback(db),
	);

	db = {
		insert,
		select,
		transaction,
		update,
	} as unknown as Database;

	return {
		db,
		insertValues,
		select,
		selectQueries,
		transaction,
		update,
		updateSets,
	};
}

function buildOrganizerRow(id = ORGANIZER_ID) {
	return {
		id,
		userId: USER_ID,
		businessName: "CoimbatoreRunners",
		contactName: "Ramesh Kumar",
		contactEmail: "ramesh@example.com",
		contactPhone: "+919876543210",
		city: "Coimbatore",
		description: null,
		website: null,
		verificationStatus: "approved",
		isVerified: true,
		submittedForReviewAt: null,
		reviewedAt: null,
		reviewedBy: null,
		rejectionReason: null,
		razorpayAccountStatus: "not_started",
		razorpayAccountId: null,
		razorpayLinkedAt: null,
		razorpayRawStatus: null,
		razorpayLastError: null,
		razorpayLastSyncedAt: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
	};
}

function buildEventRow(overrides: Record<string, unknown> = {}) {
	return {
		id: EVENT_ID,
		organizerId: ORGANIZER_ID,
		status: "draft",
		...overrides,
	};
}

function buildImageRow(overrides: Record<string, unknown> = {}) {
	return {
		id: IMAGE_ID,
		eventId: EVENT_ID,
		kind: "hero",
		fileName: "hero.jpg",
		contentType: "image/jpeg",
		sizeBytes: 1_024_000,
		storageKey: `events/images/${EVENT_ID}/hero.jpg`,
		status: "pending",
		uploadedBy: USER_ID,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function createStorage(overrides: Partial<StorageClient> = {}): StorageClient {
	return {
		enabled: true,
		getUploadUrl: vi.fn().mockResolvedValue({
			url: "https://storage.example.com/upload",
			method: "PUT",
			headers: { "Content-Type": "image/jpeg" },
			key: `events/images/${EVENT_ID}/generated.jpg`,
			expiresAt: new Date("2026-04-26T12:15:00.000Z"),
		}),
		getDownloadUrl: vi.fn(),
		headObject: vi.fn().mockResolvedValue({
			contentType: "image/jpeg",
			contentLength: 1_024_000,
			lastModified: UPDATED_AT,
		}),
		deleteObject: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn(),
		...overrides,
	};
}

function createAuditLogger(): AuditLogger {
	return {
		log: vi.fn().mockResolvedValue(undefined),
		logBatch: vi.fn().mockResolvedValue(undefined),
	};
}

function createDeps(db: Database, storage = createStorage()) {
	return {
		db,
		storage,
		auditLogger: createAuditLogger(),
		log: {
			info: vi.fn(),
			warn: vi.fn(),
		},
	};
}

describe("requestEventImageUpload", () => {
	it("creates a pending image and returns a presigned upload URL", async () => {
		const imageRow = buildImageRow({
			storageKey: `events/images/${EVENT_ID}/generated.jpg`,
		});
		const mockDb = createMockDb({
			selectRows: [[buildOrganizerRow()], [buildEventRow()]],
			insertRows: [imageRow],
		});
		const deps = createDeps(mockDb.db);

		const result = await requestEventImageUpload(
			deps,
			USER_ID,
			EVENT_ID,
			{
				kind: "hero",
				fileName: "hero.jpg",
				contentType: "image/jpeg",
				sizeBytes: 1_024_000,
			},
			"127.0.0.1",
		);

		expect(result).toMatchObject({
			imageId: IMAGE_ID,
			method: "PUT",
			key: `events/images/${EVENT_ID}/generated.jpg`,
		});
		expect(deps.storage.getUploadUrl).toHaveBeenCalledWith({
			category: "event-image",
			ownerId: EVENT_ID,
			extension: "jpg",
			contentType: "image/jpeg",
		});
		expect(mockDb.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				kind: "hero",
				status: "pending",
				uploadedBy: USER_ID,
			}),
		);
		expect(deps.auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: AUDIT_ACTIONS.EVENT_IMAGE_UPLOAD_REQUEST,
				resourceId: EVENT_ID,
			}),
		);
	});

	it("rejects when storage is disabled", async () => {
		const mockDb = createMockDb({ selectRows: [] });
		const storage = createStorage({ enabled: false });
		const deps = createDeps(mockDb.db, storage);

		await expect(
			requestEventImageUpload(deps, USER_ID, EVENT_ID, {
				kind: "hero",
				fileName: "hero.jpg",
				contentType: "image/jpeg",
				sizeBytes: 1_024_000,
			}),
		).rejects.toThrow(ValidationError);
		expect(storage.getUploadUrl).not.toHaveBeenCalled();
		expect(mockDb.select).not.toHaveBeenCalled();
	});
});

describe("confirmEventImageUpload", () => {
	it("confirms a pending image and replaces previous active images of the same kind", async () => {
		const uploadedRow = buildImageRow({
			status: "uploaded",
			sizeBytes: 2_048_000,
			updatedAt: new Date("2026-04-26T12:02:00.000Z"),
		});
		const mockDb = createMockDb({
			selectRows: [[buildOrganizerRow()], [buildEventRow()], [buildImageRow()]],
			updateRows: [[uploadedRow]],
		});
		const deps = createDeps(
			mockDb.db,
			createStorage({
				headObject: vi.fn().mockResolvedValue({
					contentType: "image/jpeg",
					contentLength: 2_048_000,
					lastModified: UPDATED_AT,
				}),
			}),
		);

		const result = await confirmEventImageUpload(
			deps,
			USER_ID,
			EVENT_ID,
			IMAGE_ID,
		);

		expect(result.status).toBe("uploaded");
		expect(result.sizeBytes).toBe(2_048_000);
		expect(mockDb.transaction).toHaveBeenCalledOnce();
		expect(mockDb.updateSets).toEqual([
			expect.objectContaining({ status: "replaced" }),
			expect.objectContaining({ status: "uploaded", sizeBytes: 2_048_000 }),
		]);
		expect(deps.auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: AUDIT_ACTIONS.EVENT_IMAGE_UPLOAD_CONFIRM,
				resourceId: EVENT_ID,
			}),
		);
	});

	it("returns a validation error when the uploaded object is missing", async () => {
		const mockDb = createMockDb({
			selectRows: [[buildOrganizerRow()], [buildEventRow()], [buildImageRow()]],
		});
		const storage = createStorage({
			headObject: vi.fn().mockResolvedValue(null),
		});

		await expect(
			confirmEventImageUpload(
				createDeps(mockDb.db, storage),
				USER_ID,
				EVENT_ID,
				IMAGE_ID,
			),
		).rejects.toThrow(ValidationError);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("deletes and marks the row deleted when the uploaded object is too large", async () => {
		const mockDb = createMockDb({
			selectRows: [[buildOrganizerRow()], [buildEventRow()], [buildImageRow()]],
		});
		const storage = createStorage({
			headObject: vi.fn().mockResolvedValue({
				contentType: "image/jpeg",
				contentLength: MAX_FILE_SIZES["event-image"] + 1,
				lastModified: UPDATED_AT,
			}),
		});

		await expect(
			confirmEventImageUpload(
				createDeps(mockDb.db, storage),
				USER_ID,
				EVENT_ID,
				IMAGE_ID,
			),
		).rejects.toThrow(ValidationError);
		expect(storage.deleteObject).toHaveBeenCalledWith(
			`events/images/${EVENT_ID}/hero.jpg`,
		);
		expect(mockDb.updateSets).toEqual([
			expect.objectContaining({ status: "deleted" }),
		]);
	});
});

describe("listEventImages", () => {
	it("does not leak draft images to unauthenticated callers", async () => {
		const mockDb = createMockDb({
			selectRows: [[buildEventRow({ status: "draft" })]],
		});

		await expect(listEventImages(mockDb.db, EVENT_ID)).rejects.toThrow(
			"Event not found",
		);
		expect(mockDb.select).toHaveBeenCalledOnce();
	});

	it("returns no rows for non-uploaded status filters on public events", async () => {
		const mockDb = createMockDb({
			selectRows: [[buildEventRow({ status: "published" })]],
		});

		const result = await listEventImages(mockDb.db, EVENT_ID, {
			status: "pending",
		});

		expect(result).toEqual([]);
		expect(mockDb.select).toHaveBeenCalledOnce();
	});

	it("allows owners to list filtered draft images", async () => {
		const replacedImage = buildImageRow({
			status: "replaced",
			kind: "route_map",
		});
		const mockDb = createMockDb({
			selectRows: [
				[buildEventRow({ status: "draft" })],
				[buildOrganizerRow()],
				[replacedImage],
			],
		});

		const result = await listEventImages(
			mockDb.db,
			EVENT_ID,
			{ kind: "route_map", status: "replaced" },
			USER_ID,
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			kind: "route_map",
			status: "replaced",
		});
	});
});

describe("deleteEventImage", () => {
	it("deletes the object from storage, marks the row deleted, and audits the action", async () => {
		const mockDb = createMockDb({
			selectRows: [[buildOrganizerRow()], [buildEventRow()], [buildImageRow()]],
		});
		const deps = createDeps(mockDb.db);

		const result = await deleteEventImage(deps, USER_ID, EVENT_ID, IMAGE_ID);

		expect(result).toEqual({ deleted: true, imageId: IMAGE_ID, kind: "hero" });
		expect(deps.storage.deleteObject).toHaveBeenCalledWith(
			`events/images/${EVENT_ID}/hero.jpg`,
		);
		expect(mockDb.updateSets).toEqual([
			expect.objectContaining({ status: "deleted" }),
		]);
		expect(deps.auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: AUDIT_ACTIONS.EVENT_IMAGE_DELETE,
				resourceId: EVENT_ID,
			}),
		);
	});

	it("rejects when the organizer does not own the event", async () => {
		const mockDb = createMockDb({
			selectRows: [
				[buildOrganizerRow(ORGANIZER_ID)],
				[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
			],
		});

		await expect(
			deleteEventImage(createDeps(mockDb.db), USER_ID, EVENT_ID, IMAGE_ID),
		).rejects.toThrow(ForbiddenError);
	});
});
