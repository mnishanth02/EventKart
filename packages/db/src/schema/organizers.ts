import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { VERIFICATION_STATUSES } from "@repo/shared/constants";

export const verificationStatusEnum = pgEnum(
	"verification_status",
	VERIFICATION_STATUSES,
);

export const organizers = pgTable(
	"organizers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		businessName: varchar("business_name", { length: 200 }).notNull(),
		contactName: varchar("contact_name", { length: 100 }).notNull(),
		contactEmail: varchar("contact_email", { length: 255 }).notNull(),
		contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
		city: varchar("city", { length: 100 }).notNull(),
		description: text("description"),
		website: varchar("website", { length: 500 }),
		verificationStatus: verificationStatusEnum("verification_status")
			.notNull()
			.default("pending_documents"),
		isVerified: boolean("is_verified").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("organizers_user_id_unique").on(table.userId),
		index("organizers_verification_status_idx").on(table.verificationStatus),
		index("organizers_city_idx").on(table.city),
	],
);
