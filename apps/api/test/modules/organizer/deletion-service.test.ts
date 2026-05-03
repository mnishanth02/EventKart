import type { Database } from "@repo/db";
import {
	AUDIT_ACTIONS,
	AUDIT_RESOURCE_TYPES,
	EMAIL_JOB_NAMES,
	buildEmailIdempotencyKey,
} from "@repo/shared/constants";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogger } from "../../../src/lib/audit.js";
import { NotFoundError } from "../../../src/lib/errors.js";
import type { StorageClient } from "../../../src/lib/storage.js";
import {
	deleteOrganizerAccount,
	previewOrganizerDeletion,
	runDeletionSideEffects,
	type DeleteOrganizerAccountResult,
	type DeletionSideEffectsDeps,
} from "../../../src/modules/organizer/deletion-service.js";

// ── Test constants ────────────────────────────────────────────────
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ── Mock DB helpers ──────────────────────────────────────────────

type SelectRows = Record<string, unknown>[];

/**
 * Creates a mock query chain that supports:
 * - `await db.select().from().where()` (thenable where)
 * - `await db.select().from().where().limit(1)` (limit terminal)
 * - `await db.select().from().where().for("update")` (for terminal)
 */
function createSelectQuery(rows: SelectRows) {
	// Terminal object: awaitable, and has .limit() / .for() methods
	const terminal = {
		then: (
			resolve: (v: SelectRows) => void,
			reject?: (e: unknown) => void,
		) => Promise.resolve(rows).then(resolve, reject),
		limit: vi.fn().mockResolvedValue(rows),
		for: vi.fn().mockResolvedValue(rows),
	};

	const fromResult = {
		where: vi.fn().mockReturnValue(terminal),
		// Some queries end with .from() (no where), make it thenable too
		then: (
			resolve: (v: SelectRows) => void,
			reject?: (e: unknown) => void,
		) => Promise.resolve(rows).then(resolve, reject),
		limit: vi.fn().mockResolvedValue(rows),
	};

	const query = {
		from: vi.fn().mockReturnValue(fromResult),
	};

	return query;
}

function createMockDb(selectResults: SelectRows[] = []) {
	const pendingSelectResults = [...selectResults];
	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
	const updateWhere = vi.fn().mockResolvedValue(undefined);
	const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set: updateSet });
	const insertValues = vi.fn().mockResolvedValue(undefined);
	const insert = vi.fn().mockReturnValue({ values: insertValues });
	const select = vi.fn(() => {
		const rows = pendingSelectResults.shift() ?? [];
		return createSelectQuery(rows);
	});

	let db: Database;
	const transaction = vi.fn(
		async (callback: (tx: Database) => Promise<unknown>) => callback(db),
	);

	db = {
		delete: deleteFn,
		insert,
		select,
		transaction,
		update,
	} as unknown as Database;

	return {
		db,
		deleteFn,
		deleteWhere,
		insert,
		select,
		transaction,
		update,
		updateSet,
	};
}

function createMockLog() {
	return {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		trace: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn(),
	} as unknown as ReturnType<typeof vi.fn> &
		import("fastify").FastifyBaseLogger;
}

function createMockAuditLogger(): AuditLogger {
	return {
		log: vi.fn().mockResolvedValue(undefined),
		logBatch: vi.fn().mockResolvedValue(undefined),
	};
}

// ── previewOrganizerDeletion ─────────────────────────────────────

describe("previewOrganizerDeletion", () => {
	it("returns correct counts and flags for an organizer with mixed events", async () => {
		const now = new Date();
		const futureDate = new Date(now.getTime() + 86_400_000);
		const pastDate = new Date(now.getTime() - 86_400_000);

		const { db } = createMockDb([
			// First select: organizer lookup
			[
				{
					id: TEST_ORGANIZER_ID,
					businessName: "Test Org",
					razorpayAccountId: "acc_123",
					deletedAt: null,
				},
			],
			// Second select: all events
			[
				{
					id: "ev-1",
					slug: "future-event",
					title: "Future Event",
					startAt: futureDate,
					status: "published",
				},
				{
					id: "ev-2",
					slug: "past-event",
					title: "Past Event",
					startAt: pastDate,
					status: "completed",
				},
			],
			// Third select: kycDocumentCount
			[{ count: 3 }],
		]);

		const result = await previewOrganizerDeletion(db, TEST_USER_ID);

		expect(result.businessName).toBe("Test Org");
		expect(result.futureEvents).toHaveLength(1);
		expect(result.futureEvents[0]!.slug).toBe("future-event");
		expect(result.preservedEventCount).toBe(1);
		expect(result.hasRazorpayAccount).toBe(true);
		expect(result.kycDocumentCount).toBe(3);
	});

	it("returns hasRazorpayAccount false when no account linked", async () => {
		const { db } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					businessName: "Test Org",
					razorpayAccountId: null,
					deletedAt: null,
				},
			],
			[],
			[{ count: 0 }],
		]);

		const result = await previewOrganizerDeletion(db, TEST_USER_ID);
		expect(result.hasRazorpayAccount).toBe(false);
		expect(result.kycDocumentCount).toBe(0);
	});

	it("throws NotFoundError for non-existent organizer", async () => {
		const { db } = createMockDb([[]]);

		await expect(
			previewOrganizerDeletion(db, TEST_USER_ID),
		).rejects.toThrow(NotFoundError);
	});

	it("throws NotFoundError for already-deleted organizer (filtered by isNull(deletedAt))", async () => {
		// The query filters with isNull(deletedAt), so a deleted organizer returns empty
		const { db } = createMockDb([[]]);

		await expect(
			previewOrganizerDeletion(db, TEST_USER_ID),
		).rejects.toThrow(NotFoundError);
	});
});

// ── deleteOrganizerAccount ───────────────────────────────────────

describe("deleteOrganizerAccount", () => {
	const ctx = { ip: "127.0.0.1", sessionId: TEST_SESSION_ID };

	it("happy path: handles mix of future + past events correctly", async () => {
		const now = new Date();
		const futureDate = new Date(now.getTime() + 86_400_000);
		const pastDate = new Date(now.getTime() - 86_400_000);

		const { db } = createMockDb([
			// Organizer SELECT ... FOR UPDATE
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: "acc_123",
					deletedAt: null,
				},
			],
			// All events
			[
				{
					id: "ev-future",
					slug: "future-event",
					startAt: futureDate,
					status: "published",
				},
				{
					id: "ev-past",
					slug: "past-event",
					startAt: pastDate,
					status: "completed",
				},
			],
			// Images for future event
			[{ storageKey: "images/ev-future/banner.jpg" }],
			// Active sessions
			[{ id: "sess-1" }, { id: "sess-2" }],
		]);

		const log = createMockLog();
		const auditLogger = createMockAuditLogger();

		const result = await deleteOrganizerAccount(
			{ db, log, auditLogger },
			TEST_USER_ID,
			ctx,
		);

		expect(result.organizerSlug).toBe("test-org");
		expect(result.deletedEventCount).toBe(1);
		expect(result.preservedEventCount).toBe(1);
		expect(result.deletedEventSlugs).toEqual(["future-event"]);
		expect(result.preservedEventSlugs).toEqual(["past-event"]);
		expect(result.sessionIds).toEqual(["sess-1", "sess-2"]);
		expect(result.storageKeys).toEqual(["images/ev-future/banner.jpg"]);
		expect(result.razorpayAccountId).toBe("acc_123");
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: AUDIT_ACTIONS.ORGANIZER_DELETE,
				resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
				resourceId: TEST_ORGANIZER_ID,
				actorId: TEST_USER_ID,
			}),
		);
	});

	it("future event with images: collects storage keys for S3 cleanup", async () => {
		const futureDate = new Date(Date.now() + 86_400_000);

		const { db } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: null,
					deletedAt: null,
				},
			],
			[
				{
					id: "ev-1",
					slug: "ev-slug-1",
					startAt: futureDate,
					status: "draft",
				},
			],
			// Images for ev-1
			[
				{ storageKey: "images/ev-1/banner.jpg" },
				{ storageKey: "images/ev-1/thumb.png" },
			],
			// Sessions
			[],
		]);

		const result = await deleteOrganizerAccount(
			{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
			TEST_USER_ID,
			ctx,
		);

		expect(result.storageKeys).toEqual([
			"images/ev-1/banner.jpg",
			"images/ev-1/thumb.png",
		]);
	});

	it("Razorpay-linked: local ref cleared (razorpayAccountId returned for caller)", async () => {
		const { db, updateSet } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: "acc_rzp_456",
					deletedAt: null,
				},
			],
			[], // No events
			[], // Sessions
		]);

		const result = await deleteOrganizerAccount(
			{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
			TEST_USER_ID,
			ctx,
		);

		expect(result.razorpayAccountId).toBe("acc_rzp_456");
		// The soft-delete update sets razorpayAccountId to null
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				razorpayAccountId: null,
				razorpayAccountStatus: "not_started",
			}),
		);
	});

	it("second call returns NotFoundError (organizer already has deletedAt set)", async () => {
		const { db } = createMockDb([
			// Organizer has deletedAt (or not found)
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: null,
					deletedAt: new Date(),
				},
			],
		]);

		await expect(
			deleteOrganizerAccount(
				{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
				TEST_USER_ID,
				ctx,
			),
		).rejects.toThrow(NotFoundError);
	});

	it("organizer not found returns NotFoundError", async () => {
		const { db } = createMockDb([[]]);

		await expect(
			deleteOrganizerAccount(
				{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
				TEST_USER_ID,
				ctx,
			),
		).rejects.toThrow(NotFoundError);
	});

	it("organizer with no events: succeeds with empty slug arrays", async () => {
		const { db } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: null,
					deletedAt: null,
				},
			],
			[], // No events
			[], // Sessions
		]);

		const result = await deleteOrganizerAccount(
			{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
			TEST_USER_ID,
			ctx,
		);

		expect(result.deletedEventCount).toBe(0);
		expect(result.preservedEventCount).toBe(0);
		expect(result.deletedEventSlugs).toEqual([]);
		expect(result.preservedEventSlugs).toEqual([]);
		expect(result.storageKeys).toEqual([]);
	});

	it("organizer with only future events: all deleted, preservedEventCount=0", async () => {
		const futureDate = new Date(Date.now() + 86_400_000);
		const { db } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: null,
					deletedAt: null,
				},
			],
			[
				{
					id: "ev-1",
					slug: "future-1",
					startAt: futureDate,
					status: "published",
				},
				{
					id: "ev-2",
					slug: "future-2",
					startAt: new Date(Date.now() + 172_800_000),
					status: "draft",
				},
			],
			// Images for ev-1
			[],
			// Images for ev-2
			[],
			// Sessions
			[],
		]);

		const result = await deleteOrganizerAccount(
			{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
			TEST_USER_ID,
			ctx,
		);

		expect(result.deletedEventCount).toBe(2);
		expect(result.preservedEventCount).toBe(0);
		expect(result.deletedEventSlugs).toEqual(["future-1", "future-2"]);
		expect(result.preservedEventSlugs).toEqual([]);
	});

	it("organizer with only past events: none deleted, all preserved", async () => {
		const pastDate = new Date(Date.now() - 86_400_000);
		const { db } = createMockDb([
			[
				{
					id: TEST_ORGANIZER_ID,
					slug: "test-org",
					razorpayAccountId: null,
					deletedAt: null,
				},
			],
			[
				{
					id: "ev-1",
					slug: "past-1",
					startAt: pastDate,
					status: "completed",
				},
				{
					id: "ev-2",
					slug: "past-2",
					startAt: new Date(Date.now() - 172_800_000),
					status: "completed",
				},
			],
			// Sessions
			[],
		]);

		const result = await deleteOrganizerAccount(
			{ db, log: createMockLog(), auditLogger: createMockAuditLogger() },
			TEST_USER_ID,
			ctx,
		);

		expect(result.deletedEventCount).toBe(0);
		expect(result.preservedEventCount).toBe(2);
		expect(result.deletedEventSlugs).toEqual([]);
		expect(result.preservedEventSlugs).toEqual(["past-1", "past-2"]);
	});
});

// ── runDeletionSideEffects ───────────────────────────────────────

describe("runDeletionSideEffects", () => {
	function createMockDeps(
		overrides: Partial<DeletionSideEffectsDeps> = {},
	): DeletionSideEffectsDeps {
		return {
			log: createMockLog(),
			redis: {
				session: { del: vi.fn().mockResolvedValue(1) } as unknown as import("ioredis").Redis,
				cache: { del: vi.fn().mockResolvedValue(1) } as unknown as import("ioredis").Redis,
			},
			storage: {
				deleteObject: vi.fn().mockResolvedValue(undefined),
				enabled: true,
			} as unknown as StorageClient,
			...overrides,
		};
	}

	function createMockResult(
		overrides: Partial<DeleteOrganizerAccountResult> = {},
	): DeleteOrganizerAccountResult {
		return {
			organizerSlug: "test-org",
			deletedEventSlugs: ["ev-slug-1"],
			preservedEventSlugs: ["ev-slug-2"],
			deletedEventCount: 1,
			preservedEventCount: 1,
			sessionIds: ["sess-1", "sess-2"],
			storageKeys: ["images/banner.jpg"],
			razorpayAccountId: null,
			...overrides,
		};
	}

	it("deletes Redis sessions for all session IDs", async () => {
		const deps = createMockDeps();
		const result = createMockResult({ sessionIds: ["s1", "s2", "s3"] });

		await runDeletionSideEffects(deps, result);

		const redisDel = deps.redis.session.del as ReturnType<typeof vi.fn>;
		expect(redisDel).toHaveBeenCalledTimes(3);
		expect(redisDel).toHaveBeenCalledWith("s1");
		expect(redisDel).toHaveBeenCalledWith("s2");
		expect(redisDel).toHaveBeenCalledWith("s3");
	});

	it("retries Redis session deletion on first failure", async () => {
		const sessionDel = vi
			.fn()
			.mockRejectedValueOnce(new Error("connection reset"))
			.mockResolvedValueOnce(1);
		const deps = createMockDeps({
			redis: {
				session: { del: sessionDel } as unknown as import("ioredis").Redis,
				cache: { del: vi.fn().mockResolvedValue(1) } as unknown as import("ioredis").Redis,
			},
		});
		const result = createMockResult({ sessionIds: ["s1"] });

		await runDeletionSideEffects(deps, result);

		// First attempt fails, retry succeeds
		expect(sessionDel).toHaveBeenCalledTimes(2);
	});

	it("logs error when Redis session deletion fails after retry", async () => {
		const sessionDel = vi.fn().mockRejectedValue(new Error("connection lost"));
		const log = createMockLog();
		const deps = createMockDeps({
			log,
			redis: {
				session: { del: sessionDel } as unknown as import("ioredis").Redis,
				cache: { del: vi.fn().mockResolvedValue(1) } as unknown as import("ioredis").Redis,
			},
		});
		const result = createMockResult({ sessionIds: ["s1"] });

		await runDeletionSideEffects(deps, result);

		expect(log.error).toHaveBeenCalled();
	});

	it("evicts cache for organizer slug and all event slugs", async () => {
		const cacheDel = vi.fn().mockResolvedValue(1);
		const deps = createMockDeps({
			redis: {
				session: { del: vi.fn().mockResolvedValue(1) } as unknown as import("ioredis").Redis,
				cache: { del: cacheDel } as unknown as import("ioredis").Redis,
			},
		});
		const result = createMockResult({
			organizerSlug: "my-org",
			deletedEventSlugs: ["ev-1", "ev-2"],
			preservedEventSlugs: ["ev-3"],
		});

		await runDeletionSideEffects(deps, result);

		// Organizer cache + 3 event caches
		expect(cacheDel).toHaveBeenCalled();
	});

	it("enqueues CDN purge when cdnPurgeQueue AND cdnBaseUrl present", async () => {
		const queueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
		const cdnPurgeQueue = { add: queueAdd } as unknown as import("bullmq").Queue;
		const deps = createMockDeps({
			cdnPurgeQueue,
			cdnBaseUrl: "https://cdn.example.com",
		});
		const result = createMockResult({
			organizerSlug: "my-org",
			deletedEventSlugs: ["ev-1"],
			preservedEventSlugs: ["ev-2"],
		});

		await runDeletionSideEffects(deps, result);

		expect(queueAdd).toHaveBeenCalled();
	});

	it("does NOT enqueue CDN purge when cdnBaseUrl missing", async () => {
		const queueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
		const cdnPurgeQueue = { add: queueAdd } as unknown as import("bullmq").Queue;
		const deps = createMockDeps({
			cdnPurgeQueue,
			// cdnBaseUrl intentionally omitted
		});
		const result = createMockResult();

		await runDeletionSideEffects(deps, result);

		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("enqueues sitemap regen", async () => {
		const queueAdd = vi.fn().mockResolvedValue({ id: "job-2" });
		const sitemapRegenQueue = { add: queueAdd } as unknown as import("bullmq").Queue;
		const deps = createMockDeps({ sitemapRegenQueue });
		const result = createMockResult();

		await runDeletionSideEffects(deps, result);

		expect(queueAdd).toHaveBeenCalled();
	});

	it("S3 cleanup via Promise.allSettled (does not throw on failure)", async () => {
		const deleteObject = vi.fn().mockRejectedValue(new Error("S3 error"));
		const deps = createMockDeps({
			storage: {
				deleteObject,
				enabled: true,
			} as unknown as StorageClient,
		});
		const result = createMockResult({
			storageKeys: ["key1", "key2"],
		});

		// Should not throw
		await expect(
			runDeletionSideEffects(deps, result),
		).resolves.toBeUndefined();
	});

	it("emits email stub for deletion notification", async () => {
		const log = createMockLog();
		const deps = createMockDeps({ log });
		const result = createMockResult({
			organizerSlug: "my-org",
			deletedEventSlugs: ["ev-1"],
		});

		await runDeletionSideEffects(deps, result);

		// emitEmailStub logs via log.info
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobName: EMAIL_JOB_NAMES.ORGANIZER_ACCOUNT_DELETED,
				idempotencyKey:
					buildEmailIdempotencyKey.organizerAccountDeleted("my-org"),
			}),
			expect.any(String),
		);
	});
});
