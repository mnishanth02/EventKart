import type { Database } from "@repo/db";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@repo/shared/constants";
import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AuditEntry, createAuditLogger } from "../../src/lib/audit.js";

// ── Local mock factories (independent of global setup.ts mocks) ────────

function createMockDb() {
	const mockValues = vi.fn().mockResolvedValue(undefined);
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
	return {
		db: { insert: mockInsert } as unknown as Database,
		mockInsert,
		mockValues,
	};
}

function createMockLogger() {
	return {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		trace: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn(),
		level: "info",
		silent: vi.fn(),
	} as unknown as FastifyBaseLogger;
}

function getFirstMockArg(mockFn: ReturnType<typeof vi.fn>): unknown {
	const firstCall = mockFn.mock.calls[0];
	expect(firstCall).toBeDefined();
	if (!firstCall) {
		throw new Error("Expected mock to have at least one call");
	}

	return firstCall[0];
}

function getFirstTwoMockArgs(
	mockFn: ReturnType<typeof vi.fn>,
): [unknown, unknown] {
	const firstCall = mockFn.mock.calls[0];
	expect(firstCall).toBeDefined();
	expect(firstCall?.length).toBeGreaterThanOrEqual(2);
	if (!firstCall || firstCall.length < 2) {
		throw new Error("Expected mock call to have at least two arguments");
	}

	return [firstCall[0], firstCall[1]];
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("createAuditLogger", () => {
	let mockInsert: ReturnType<typeof vi.fn>;
	let mockValues: ReturnType<typeof vi.fn>;
	let db: Database;
	let log: FastifyBaseLogger;

	beforeEach(() => {
		const mocks = createMockDb();
		db = mocks.db;
		mockInsert = mocks.mockInsert;
		mockValues = mocks.mockValues;
		log = createMockLogger();
	});

	// ── log() ─────────────────────────────────────────────────────────

	describe("log()", () => {
		it("writes a single entry with all fields", async () => {
			const logger = createAuditLogger(db, log);

			const entry: AuditEntry = {
				actorId: "user-123",
				actorRole: "admin",
				action: AUDIT_ACTIONS.USER_CREATE,
				resourceType: AUDIT_RESOURCE_TYPES.USER,
				resourceId: "user-456",
				metadata: { reason: "manual creation" },
				ipAddress: "192.168.1.1",
			};

			await logger.log(entry);

			expect(mockInsert).toHaveBeenCalledOnce();
			expect(mockValues).toHaveBeenCalledWith({
				actorId: "user-123",
				actorRole: "admin",
				action: "user.create",
				resourceType: "user",
				resourceId: "user-456",
				metadata: { reason: "manual creation" },
				ipAddress: "192.168.1.1",
			});
		});

		it("defaults optional fields to null", async () => {
			const logger = createAuditLogger(db, log);

			await logger.log({
				action: AUDIT_ACTIONS.SYSTEM_CLEANUP,
				resourceType: AUDIT_RESOURCE_TYPES.SESSION,
			});

			expect(mockValues).toHaveBeenCalledWith({
				actorId: null,
				actorRole: null,
				action: "system.cleanup",
				resourceType: "session",
				resourceId: null,
				metadata: null,
				ipAddress: null,
			});
		});

		it("catches DB error without throwing", async () => {
			mockValues.mockRejectedValueOnce(new Error("DB connection lost"));
			const logger = createAuditLogger(db, log);

			await expect(
				logger.log({
					action: AUDIT_ACTIONS.AUTH_LOGIN,
					resourceType: AUDIT_RESOURCE_TYPES.SESSION,
				}),
			).resolves.toBeUndefined();

			expect(log.error).toHaveBeenCalledOnce();
		});

		it("error log includes non-sensitive entry details only", async () => {
			const dbError = new Error("insert failed");
			mockValues.mockRejectedValueOnce(dbError);
			const logger = createAuditLogger(db, log);

			await logger.log({
				action: AUDIT_ACTIONS.USER_UPDATE,
				resourceType: AUDIT_RESOURCE_TYPES.USER,
				resourceId: "user-789",
				metadata: { sensitiveField: "should-not-be-logged" },
			});

			const [contextArg, messageArg] = getFirstTwoMockArgs(
				log.error as ReturnType<typeof vi.fn>,
			);
			const context = contextArg as Record<string, unknown>;
			const message = messageArg as string;

			expect(message).toBe("Failed to write audit log entry");
			expect(context).toHaveProperty("err", dbError);
			expect(context).toHaveProperty("auditEntry");

			const auditEntry = context.auditEntry as Record<string, unknown>;
			expect(auditEntry).toStrictEqual({
				action: "user.update",
				resourceType: "user",
				resourceId: "user-789",
			});

			// metadata must NOT appear in the error log context
			expect(auditEntry).not.toHaveProperty("metadata");
			expect(auditEntry).not.toHaveProperty("actorId");
			expect(auditEntry).not.toHaveProperty("ipAddress");
		});

		it("passes metadata as-is for JSONB storage", async () => {
			const logger = createAuditLogger(db, log);

			const complexMetadata = {
				changes: {
					before: { role: "participant" },
					after: { role: "organizer" },
				},
				tags: ["escalation", "manual"],
				nested: { deep: { value: 42 } },
			};

			await logger.log({
				action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
				resourceType: AUDIT_RESOURCE_TYPES.USER,
				resourceId: "user-100",
				metadata: complexMetadata,
			});

			const valuesArg = getFirstMockArg(mockValues) as Record<string, unknown>;
			expect(valuesArg.metadata).toStrictEqual(complexMetadata);
		});

		it("uses audit constants correctly as action and resourceType", async () => {
			const logger = createAuditLogger(db, log);

			await logger.log({
				actorId: "admin-1",
				actorRole: "admin",
				action: AUDIT_ACTIONS.ORGANIZER_APPROVE,
				resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
				resourceId: "org-55",
			});

			const valuesArg = getFirstMockArg(mockValues) as Record<string, unknown>;
			expect(valuesArg.action).toBe("organizer.approve");
			expect(valuesArg.resourceType).toBe("organizer");
		});

		it("coerces undefined optional fields from explicit undefined to null", async () => {
			const logger = createAuditLogger(db, log);

			await logger.log({
				actorId: undefined,
				actorRole: undefined,
				action: AUDIT_ACTIONS.EVENT_PUBLISH,
				resourceType: AUDIT_RESOURCE_TYPES.EVENT,
				resourceId: undefined,
				metadata: undefined,
				ipAddress: undefined,
			});

			expect(mockValues).toHaveBeenCalledWith({
				actorId: null,
				actorRole: null,
				action: "event.publish",
				resourceType: "event",
				resourceId: null,
				metadata: null,
				ipAddress: null,
			});
		});
	});

	// ── logBatch() ────────────────────────────────────────────────────

	describe("logBatch()", () => {
		it("writes multiple entries in a single INSERT", async () => {
			const logger = createAuditLogger(db, log);

			const entries: AuditEntry[] = [
				{
					actorId: "user-1",
					actorRole: "participant",
					action: AUDIT_ACTIONS.BOOKING_CREATE,
					resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
					resourceId: "booking-1",
				},
				{
					actorId: "user-2",
					actorRole: "organizer",
					action: AUDIT_ACTIONS.EVENT_UPDATE,
					resourceType: AUDIT_RESOURCE_TYPES.EVENT,
					resourceId: "event-1",
					metadata: { field: "title" },
				},
				{
					action: AUDIT_ACTIONS.SYSTEM_MIGRATION,
					resourceType: AUDIT_RESOURCE_TYPES.USER,
				},
			];

			await logger.logBatch(entries);

			expect(mockInsert).toHaveBeenCalledOnce();
			expect(mockValues).toHaveBeenCalledOnce();

			const valuesArg = getFirstMockArg(mockValues) as Record<
				string,
				unknown
			>[];
			expect(valuesArg).toHaveLength(3);
			expect(valuesArg[0]).toStrictEqual({
				actorId: "user-1",
				actorRole: "participant",
				action: "booking.create",
				resourceType: "booking",
				resourceId: "booking-1",
				metadata: null,
				ipAddress: null,
			});
			expect(valuesArg[1]).toStrictEqual({
				actorId: "user-2",
				actorRole: "organizer",
				action: "event.update",
				resourceType: "event",
				resourceId: "event-1",
				metadata: { field: "title" },
				ipAddress: null,
			});
			expect(valuesArg[2]).toStrictEqual({
				actorId: null,
				actorRole: null,
				action: "system.migration",
				resourceType: "user",
				resourceId: null,
				metadata: null,
				ipAddress: null,
			});
		});

		it("is a no-op for an empty array", async () => {
			const logger = createAuditLogger(db, log);

			await logger.logBatch([]);

			expect(mockInsert).not.toHaveBeenCalled();
			expect(mockValues).not.toHaveBeenCalled();
		});

		it("catches DB error without throwing", async () => {
			mockValues.mockRejectedValueOnce(new Error("batch insert failed"));
			const logger = createAuditLogger(db, log);

			await expect(
				logger.logBatch([
					{
						action: AUDIT_ACTIONS.BOOKING_CANCEL,
						resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
						resourceId: "b-1",
					},
					{
						action: AUDIT_ACTIONS.BOOKING_REFUND,
						resourceType: AUDIT_RESOURCE_TYPES.PAYMENT,
						resourceId: "p-1",
					},
				]),
			).resolves.toBeUndefined();

			expect(log.error).toHaveBeenCalledOnce();
		});

		it("error log includes entry count", async () => {
			const batchError = new Error("timeout");
			mockValues.mockRejectedValueOnce(batchError);
			const logger = createAuditLogger(db, log);

			await logger.logBatch([
				{ action: "a", resourceType: "r" },
				{ action: "b", resourceType: "r" },
				{ action: "c", resourceType: "r" },
			]);

			const [contextArg, messageArg] = getFirstTwoMockArgs(
				log.error as ReturnType<typeof vi.fn>,
			);
			const context = contextArg as Record<string, unknown>;
			const message = messageArg as string;

			expect(message).toBe("Failed to write audit log batch");
			expect(context).toHaveProperty("err", batchError);
			expect(context).toHaveProperty("count", 3);
		});
	});
});
