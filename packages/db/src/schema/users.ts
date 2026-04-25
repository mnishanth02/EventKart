import { USER_ROLES } from "@repo/shared/constants";
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

export const userRoleEnum = pgEnum("user_role", USER_ROLES);

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		phone: varchar("phone", { length: 20 }),
		email: varchar("email", { length: 255 }),
		name: varchar("name", { length: 255 }),
		role: userRoleEnum("role").notNull().default("public"),
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
		uniqueIndex("users_phone_unique")
			.on(table.phone)
			.where(sql`deleted_at IS NULL AND phone IS NOT NULL`),
		uniqueIndex("users_email_unique")
			.on(table.email)
			.where(sql`deleted_at IS NULL AND email IS NOT NULL`),
		index("users_role_idx").on(table.role),
	],
);
