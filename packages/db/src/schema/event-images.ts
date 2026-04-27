import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { events } from "./events.js";
import { users } from "./users.js";

export const eventImageKindEnum = pgEnum("event_image_kind", [
	"hero",
	"route_map",
]);

export const eventImageStatusEnum = pgEnum("event_image_status", [
	"pending",
	"uploaded",
	"replaced",
	"deleted",
]);

export const eventImages = pgTable(
	"event_images",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		kind: eventImageKindEnum("kind").notNull(),
		fileName: varchar("file_name", { length: 255 }).notNull(),
		contentType: varchar("content_type", { length: 100 }).notNull(),
		sizeBytes: integer("size_bytes"),
		storageKey: varchar("storage_key", { length: 500 }).notNull(),
		status: eventImageStatusEnum("status").notNull().default("pending"),
		uploadedBy: uuid("uploaded_by")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("event_images_storage_key_unique").on(table.storageKey),
		index("event_images_event_id_idx").on(table.eventId),
		index("event_images_status_idx").on(table.status),
		index("event_images_active_event_kind_idx")
			.on(table.eventId, table.kind)
			.where(sql`status IN ('pending', 'uploaded')`),
		check(
			"event_images_content_type_check",
			sql.raw(`"content_type" IN ('image/jpeg', 'image/png', 'image/webp')`),
		),
		check(
			"event_images_size_bytes_positive_check",
			sql.raw(`"size_bytes" IS NULL OR "size_bytes" > 0`),
		),
	],
);
