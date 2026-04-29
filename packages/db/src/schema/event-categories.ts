import {
	EVENT_CATEGORY_DEFAULT_SPOTS,
	EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH,
	EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH,
} from "@repo/shared/constants";
import { sql } from "drizzle-orm";
import {
	check,
	integer,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { events } from "./events.js";

export const eventCategories = pgTable(
	"event_categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		name: varchar("name", {
			length: EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH,
		}).notNull(),
		slug: varchar("slug", {
			length: EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH,
		}).notNull(),
		distanceMeters: integer("distance_meters").notNull(),
		sortOrder: integer("sort_order").notNull(),
		spotsTotal: integer("spots_total")
			.notNull()
			.default(EVENT_CATEGORY_DEFAULT_SPOTS),
		spotsRemaining: integer("spots_remaining")
			.notNull()
			.default(EVENT_CATEGORY_DEFAULT_SPOTS),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("event_categories_event_id_slug_unique").on(
			table.eventId,
			table.slug,
		),
		unique("event_categories_event_id_name_unique").on(
			table.eventId,
			table.name,
		),
		unique("event_categories_event_id_sort_order_unique").on(
			table.eventId,
			table.sortOrder,
		),
		unique("event_categories_id_event_id_unique").on(table.id, table.eventId),
		check(
			"event_categories_name_not_blank_check",
			sql.raw(`char_length(btrim("name")) > 0`),
		),
		check(
			"event_categories_slug_format_check",
			sql.raw(`"slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
		),
		check(
			"event_categories_distance_positive_check",
			sql.raw(`"distance_meters" > 0`),
		),
		check(
			"event_categories_sort_order_non_negative_check",
			sql.raw(`"sort_order" >= 0`),
		),
		check(
			"event_categories_spots_total_positive_check",
			sql.raw(`"spots_total" > 0`),
		),
		check(
			"event_categories_spots_remaining_non_negative_check",
			sql.raw(`"spots_remaining" >= 0`),
		),
		check(
			"event_categories_spots_remaining_lte_total_check",
			sql.raw(`"spots_remaining" <= "spots_total"`),
		),
	],
);
