import { sql } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const consentTypeEnum = pgEnum("consent_type", [
	"booking_terms",
	"data_usage",
	"marketing",
]);

/** DPDPA-compliant consent tracking — records retained even after user deletion */
export const consentRecords = pgTable(
	"consent_records",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		participantId: uuid("participant_id")
			.notNull()
			.references(() => users.id),
		consentType: consentTypeEnum("consent_type").notNull(),
		consentVersion: varchar("consent_version", { length: 50 }).notNull(),
		acceptedAt: timestamp("accepted_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
		ipAddress: varchar("ip_address", { length: 45 }),
	},
	(table) => [
		uniqueIndex("consent_active_unique")
			.on(table.participantId, table.consentType, table.consentVersion)
			.where(sql`withdrawn_at IS NULL`),
		index("consent_records_participant_id_idx").on(table.participantId),
	],
);
