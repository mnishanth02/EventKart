import type { Database } from "@repo/db";
import { auditLog } from "@repo/db/schema";
import type { UserRole } from "@repo/shared/constants";
import type { FastifyBaseLogger } from "fastify";

export interface AuditEntry {
	actorId?: string | null;
	actorRole?: UserRole | null;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	metadata?: Record<string, unknown> | null;
	ipAddress?: string | null;
}

export interface AuditLogger {
	log(entry: AuditEntry): Promise<void>;
	logBatch(entries: readonly AuditEntry[]): Promise<void>;
}

/**
 * Create an audit logger that writes to the audit_log table.
 *
 * Errors are caught and logged — audit writes never fail the caller.
 * Callers may `await` for guaranteed delivery or fire-and-forget.
 *
 * **Security note:** Do not include PII, secrets, or tokens in metadata.
 */
export function createAuditLogger(
	db: Database,
	log: FastifyBaseLogger,
): AuditLogger {
	return {
		async log(entry: AuditEntry): Promise<void> {
			try {
				await db.insert(auditLog).values({
					actorId: entry.actorId ?? null,
					actorRole: entry.actorRole ?? null,
					action: entry.action,
					resourceType: entry.resourceType,
					resourceId: entry.resourceId ?? null,
					metadata: entry.metadata ?? null,
					ipAddress: entry.ipAddress ?? null,
				});
			} catch (err) {
				log.error(
					{
						err,
						auditEntry: {
							action: entry.action,
							resourceType: entry.resourceType,
							resourceId: entry.resourceId,
						},
					},
					"Failed to write audit log entry",
				);
			}
		},

		async logBatch(entries: readonly AuditEntry[]): Promise<void> {
			if (entries.length === 0) return;

			try {
				await db.insert(auditLog).values(
					entries.map((entry) => ({
						actorId: entry.actorId ?? null,
						actorRole: entry.actorRole ?? null,
						action: entry.action,
						resourceType: entry.resourceType,
						resourceId: entry.resourceId ?? null,
						metadata: entry.metadata ?? null,
						ipAddress: entry.ipAddress ?? null,
					})),
				);
			} catch (err) {
				log.error(
					{ err, count: entries.length },
					"Failed to write audit log batch",
				);
			}
		},
	};
}
