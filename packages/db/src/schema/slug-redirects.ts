import {
	index,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const slugRedirectResourceTypeEnum = pgEnum(
	"slug_redirect_resource_type",
	["event", "organizer"],
);

export const slugRedirects = pgTable(
	"slug_redirects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		oldSlug: varchar("old_slug", { length: 120 }).notNull(),
		newSlug: varchar("new_slug", { length: 120 }).notNull(),
		resourceType: slugRedirectResourceTypeEnum("resource_type").notNull(),
		resourceId: uuid("resource_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("slug_redirects_resource_type_old_slug_unique").on(
			table.resourceType,
			table.oldSlug,
		),
		index("slug_redirects_resource_lookup_idx").on(
			table.resourceType,
			table.resourceId,
		),
		index("slug_redirects_new_slug_idx").on(table.resourceType, table.newSlug),
	],
);
