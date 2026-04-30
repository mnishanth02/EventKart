import {
	EVENT_CATEGORIES,
	EVENT_CURRENCIES,
	EVENT_REGISTRATION_FORM_SCHEMA_VERSION,
	EVENT_SPORTS,
	EVENT_STATUSES,
	EVENT_TYPES,
	V1_EVENT_CATEGORY,
	V1_EVENT_CITY,
	V1_EVENT_COUNTRY,
	V1_EVENT_CURRENCY,
	V1_EVENT_IS_PAID,
	V1_EVENT_SPORT,
	V1_EVENT_STATE,
	V1_EVENT_TIMEZONE,
	V1_EVENT_TYPE,
} from "@repo/shared/constants";
import type { EventRegistrationForm } from "@repo/shared/schemas";
import { defaultEventRegistrationFormSchema } from "@repo/shared/schemas";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizers } from "./organizers.js";

export const eventStatusEnum = pgEnum("event_status", EVENT_STATUSES);

export const eventTypeEnum = pgEnum("event_type", EVENT_TYPES);
export const eventSportEnum = pgEnum("event_sport", EVENT_SPORTS);
export const eventCategoryEnum = pgEnum("event_category", EVENT_CATEGORIES);
export const eventCurrencyEnum = pgEnum("event_currency", EVENT_CURRENCIES);

export const events = pgTable(
	"events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizerId: uuid("organizer_id")
			.notNull()
			.references(() => organizers.id, { onDelete: "restrict" }),
		title: varchar("title", { length: 200 }).notNull(),
		slug: varchar("slug", { length: 120 }).notNull(),
		description: text("description").notNull(),
		eventType: eventTypeEnum("event_type").notNull().default(V1_EVENT_TYPE),
		sport: eventSportEnum("sport").notNull().default(V1_EVENT_SPORT),
		category: eventCategoryEnum("category")
			.notNull()
			.default(V1_EVENT_CATEGORY),
		venueName: varchar("venue_name", { length: 200 }).notNull(),
		addressLine1: varchar("address_line1", { length: 255 }).notNull(),
		addressLine2: varchar("address_line2", { length: 255 }),
		city: varchar("city", { length: 100 }).notNull().default(V1_EVENT_CITY),
		state: varchar("state", { length: 100 }).notNull().default(V1_EVENT_STATE),
		country: varchar("country", { length: 100 })
			.notNull()
			.default(V1_EVENT_COUNTRY),
		postalCode: varchar("postal_code", { length: 20 }),
		timezone: varchar("timezone", { length: 64 })
			.notNull()
			.default(V1_EVENT_TIMEZONE),
		startAt: timestamp("start_at", { withTimezone: true }).notNull(),
		endAt: timestamp("end_at", { withTimezone: true }).notNull(),
		registrationOpensAt: timestamp("registration_opens_at", {
			withTimezone: true,
		}),
		registrationClosesAt: timestamp("registration_closes_at", {
			withTimezone: true,
		}),
		routeDetails: text("route_details").notNull(),
		refundPolicy: text("refund_policy"),
		cancellationPolicy: text("cancellation_policy"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
		submittedForReviewAt: timestamp("submitted_for_review_at", {
			withTimezone: true,
		}),
		isPaid: boolean("is_paid").notNull().default(V1_EVENT_IS_PAID),
		currency: eventCurrencyEnum("currency")
			.notNull()
			.default(V1_EVENT_CURRENCY),
		status: eventStatusEnum("status").notNull().default("draft"),
		formSchema: jsonb("form_schema")
			.$type<EventRegistrationForm>()
			.notNull()
			.default(defaultEventRegistrationFormSchema),
		formSchemaVersion: integer("form_schema_version")
			.notNull()
			.default(EVENT_REGISTRATION_FORM_SCHEMA_VERSION),
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
		index("events_public_listing_order_idx")
			.on(table.startAt, table.id)
			.where(sql`${table.status} = 'published'`),
		index("events_public_listing_active_idx")
			.on(table.endAt)
			.where(sql`${table.status} = 'published'`),
		index("events_organizer_first_published_paid_idx")
			.on(table.organizerId, table.firstPublishedAt)
			.where(
				sql`${table.firstPublishedAt} IS NOT NULL AND ${table.isPaid} = true`,
			),
		check("events_v1_city_check", sql.raw(`"city" = '${V1_EVENT_CITY}'`)),
		check("events_v1_state_check", sql.raw(`"state" = '${V1_EVENT_STATE}'`)),
		check(
			"events_v1_country_check",
			sql.raw(`"country" = '${V1_EVENT_COUNTRY}'`),
		),
		check(
			"events_v1_timezone_check",
			sql.raw(`"timezone" = '${V1_EVENT_TIMEZONE}'`),
		),
		check("events_v1_paid_check", sql.raw('"is_paid" = true')),
		check(
			"events_form_schema_version_check",
			sql.raw(
				`"form_schema" ? 'version' AND ("form_schema"->>'version')::integer = "form_schema_version"`,
			),
		),
	],
);
