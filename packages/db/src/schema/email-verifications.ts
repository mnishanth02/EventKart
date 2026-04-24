import {
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const emailVerifications = pgTable(
	"email_verifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		email: varchar("email", { length: 255 }).notNull(),
		tokenHash: varchar("token_hash", { length: 64 }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		verifiedAt: timestamp("verified_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("email_verifications_token_hash_unique").on(table.tokenHash),
		index("email_verifications_user_id_idx").on(table.userId),
	],
);
