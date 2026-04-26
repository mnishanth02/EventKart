import {
	EVENT_PRICING_MAX_PRICE_PAISE,
	EVENT_PRICING_MIN_PRICE_PAISE,
} from "@repo/shared/constants";
import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	pgTable,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { eventCategories } from "./event-categories.js";
import { events } from "./events.js";

export const eventPricingTiers = pgTable(
	"event_pricing_tiers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		eventCategoryId: uuid("event_category_id")
			.notNull()
			.references(() => eventCategories.id, { onDelete: "cascade" }),
		basePrice: integer("base_price").notNull(),
		earlyBirdPrice: integer("early_bird_price"),
		earlyBirdDeadline: timestamp("early_bird_deadline", {
			withTimezone: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("event_pricing_tiers_event_id_category_id_unique").on(
			table.eventId,
			table.eventCategoryId,
		),
		foreignKey({
			name: "event_pricing_tiers_event_category_event_id_fk",
			columns: [table.eventCategoryId, table.eventId],
			foreignColumns: [eventCategories.id, eventCategories.eventId],
		}).onDelete("cascade"),
		check(
			"event_pricing_tiers_base_price_check",
			sql.raw(
				`"base_price" >= ${EVENT_PRICING_MIN_PRICE_PAISE} AND "base_price" <= ${EVENT_PRICING_MAX_PRICE_PAISE}`,
			),
		),
		check(
			"event_pricing_tiers_early_bird_price_check",
			sql.raw(
				`"early_bird_price" IS NULL OR ("early_bird_price" >= ${EVENT_PRICING_MIN_PRICE_PAISE} AND "early_bird_price" < "base_price")`,
			),
		),
		check(
			"event_pricing_tiers_early_bird_pair_check",
			sql.raw(
				`("early_bird_price" IS NULL AND "early_bird_deadline" IS NULL) OR ("early_bird_price" IS NOT NULL AND "early_bird_deadline" IS NOT NULL)`,
			),
		),
	],
);
