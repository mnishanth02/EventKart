import {
	index,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizers } from "./organizers.js";

export const eventStatusEnum = pgEnum("event_status", [
	"draft",
	"under_review",
	"published",
	"completed",
	"cancelled",
]);

export const events = pgTable(
	"events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizerId: uuid("organizer_id")
			.notNull()
			.references(() => organizers.id, { onDelete: "restrict" }),
		title: varchar("title", { length: 200 }).notNull(),
		slug: varchar("slug", { length: 120 }).notNull(),
		status: eventStatusEnum("status").notNull().default("draft"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("events_slug_unique").on(table.slug),
		index("events_organizer_id_idx").on(table.organizerId),
		index("events_status_idx").on(table.status),
	],
);
