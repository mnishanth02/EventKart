import {
	index,
	jsonb,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { userRoleEnum } from "./users.js";

/** Append-only audit trail — no FK on actor_id (logs outlive users, 3yr retention) */
export const auditLog = pgTable(
	"audit_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		actorId: uuid("actor_id"),
		actorRole: userRoleEnum("actor_role"),
		action: varchar("action", { length: 100 }).notNull(),
		resourceType: varchar("resource_type", { length: 100 }).notNull(),
		resourceId: varchar("resource_id", { length: 255 }),
		metadata: jsonb("metadata"),
		ipAddress: varchar("ip_address", { length: 45 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("audit_log_actor_created_idx").on(table.actorId, table.createdAt),
		index("audit_log_resource_idx").on(
			table.resourceType,
			table.resourceId,
			table.createdAt,
		),
		index("audit_log_created_at_idx").on(table.createdAt),
	],
);
