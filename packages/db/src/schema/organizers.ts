import {
	RAZORPAY_ACCOUNT_STATUSES,
	VERIFICATION_STATUSES,
} from "@repo/shared/constants";
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

export const verificationStatusEnum = pgEnum(
	"verification_status",
	VERIFICATION_STATUSES,
);

export const razorpayAccountStatusEnum = pgEnum(
	"razorpay_account_status",
	RAZORPAY_ACCOUNT_STATUSES,
);

export const organizers = pgTable(
	"organizers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		businessName: varchar("business_name", { length: 200 }).notNull(),
		slug: varchar("slug", { length: 80 }).notNull(),
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
		submittedForReviewAt: timestamp("submitted_for_review_at", {
			withTimezone: true,
		}),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		reviewedBy: uuid("reviewed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		rejectionReason: text("rejection_reason"),
		razorpayAccountId: varchar("razorpay_account_id", { length: 255 }),
		razorpayAccountStatus: razorpayAccountStatusEnum("razorpay_account_status")
			.notNull()
			.default("not_started"),
		razorpayLinkedAt: timestamp("razorpay_linked_at", {
			withTimezone: true,
		}),
		razorpayRawStatus: varchar("razorpay_raw_status", { length: 100 }),
		razorpayLastError: text("razorpay_last_error"),
		razorpayLastSyncedAt: timestamp("razorpay_last_synced_at", {
			withTimezone: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("organizers_user_id_unique")
			.on(table.userId)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex("organizers_slug_unique")
			.on(table.slug)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex("organizers_razorpay_account_id_unique")
			.on(table.razorpayAccountId)
			.where(sql`deleted_at IS NULL AND razorpay_account_id IS NOT NULL`),
		index("organizers_deleted_at_idx")
			.on(table.deletedAt)
			.where(sql`deleted_at IS NOT NULL`),
		index("organizers_verification_status_idx").on(table.verificationStatus),
		index("organizers_city_idx").on(table.city),
	],
);
