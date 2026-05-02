import {
	and,
	type Database,
	desc,
	eq,
	gt,
	inArray,
	lte,
	type SQL,
	sql,
} from "@repo/db";
import {
	eventCategories,
	eventImages,
	eventPricingTiers,
	events,
	organizers,
} from "@repo/db/schema";
import {
	type EventPublicCard,
	eventPublicCardSchema,
	type OffsetPaginationMeta,
	type OrganizerSlug,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { StorageClient } from "../../lib/storage.js";
import {
	type EventCategoryRow,
	type EventImageRow,
	type EventPricingTierRow,
	type PublicEventFeatureFlags,
	projectCategoryForPublic,
	projectPricingTierForPublic,
	toPublicImage,
} from "./public-detail-service.js";

type EventRow = typeof events.$inferSelect;
type EventListingRow = Pick<
	EventRow,
	| "id"
	| "slug"
	| "title"
	| "startAt"
	| "endAt"
	| "timezone"
	| "city"
	| "venueName"
	| "registrationOpensAt"
	| "registrationClosesAt"
	| "isPaid"
	| "currency"
	| "status"
>;

const DEFAULT_FEATURE_FLAGS: PublicEventFeatureFlags = {
	spotsRemainingEnabled: false,
};

export interface PublicEventListingDeps {
	db: Database;
	storage: StorageClient;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	featureFlags?: PublicEventFeatureFlags;
}

export interface PublicEventListingParams {
	page: number;
	limit: number;
	sort: "startAtAsc" | "startAtDesc";
	now: Date;
	timeWindow: "upcoming" | "past";
	organizerSlug?: OrganizerSlug;
	organizerId?: string;
}

export interface PublicEventListingResult {
	data: EventPublicCard[];
	meta: OffsetPaginationMeta;
}

export function buildOffsetPaginationMeta({
	page,
	limit,
	total,
}: {
	page: number;
	limit: number;
	total: number;
}): OffsetPaginationMeta {
	if (total === 0) {
		return {
			page,
			limit,
			total,
			totalPages: 0,
			hasNext: false,
			hasPrev: false,
		};
	}

	const totalPages = Math.ceil(total / limit);
	return {
		page,
		limit,
		total,
		totalPages,
		hasNext: page * limit < total,
		hasPrev: page > 1,
	};
}

function groupByEventId<T extends { eventId: string }>(
	rows: readonly T[],
): Map<string, T[]> {
	const grouped = new Map<string, T[]>();
	for (const row of rows) {
		const existing = grouped.get(row.eventId);
		if (existing) {
			existing.push(row);
		} else {
			grouped.set(row.eventId, [row]);
		}
	}
	return grouped;
}

function latestImageByEventId(rows: readonly EventImageRow[]) {
	const latestByEventId = new Map<string, EventImageRow>();
	for (const row of rows) {
		if (!latestByEventId.has(row.eventId)) {
			latestByEventId.set(row.eventId, row);
		}
	}
	return latestByEventId;
}

async function selectListingRows(
	deps: PublicEventListingDeps,
	params: PublicEventListingParams,
) {
	const baseConditions: SQL[] = [];
	if (params.timeWindow === "past") {
		baseConditions.push(inArray(events.status, ["published", "completed"]));
		baseConditions.push(lte(events.endAt, params.now));
	} else {
		baseConditions.push(eq(events.status, "published"));
		baseConditions.push(gt(events.endAt, params.now));
	}
	if (params.organizerSlug !== undefined) {
		baseConditions.push(
			sql`${events.organizerId} IN (SELECT ${organizers.id} FROM ${organizers} WHERE ${organizers.slug} = ${params.organizerSlug})`,
		);
	}
	if (params.organizerId !== undefined) {
		baseConditions.push(eq(events.organizerId, params.organizerId));
	}
	const condition = and(...baseConditions);
	const offset = (params.page - 1) * params.limit;
	const orderBy =
		params.sort === "startAtDesc"
			? [desc(events.startAt), desc(events.id)]
			: [events.startAt, events.id];

	const countPromise = deps.db
		.select({ count: sql<number>`count(*)` })
		.from(events)
		.where(condition)
		.limit(1);
	const rowsPromise = deps.db
		.select({
			id: events.id,
			slug: events.slug,
			title: events.title,
			startAt: events.startAt,
			endAt: events.endAt,
			timezone: events.timezone,
			city: events.city,
			venueName: events.venueName,
			registrationOpensAt: events.registrationOpensAt,
			registrationClosesAt: events.registrationClosesAt,
			isPaid: events.isPaid,
			currency: events.currency,
			status: events.status,
		})
		.from(events)
		.where(condition)
		.orderBy(...orderBy)
		.limit(params.limit)
		.offset(offset);

	const [countRows, rows] = await Promise.all([countPromise, rowsPromise]);
	const total = Number(countRows[0]?.count ?? 0);
	return { rows, meta: buildOffsetPaginationMeta({ ...params, total }) };
}

async function selectBatchRows(db: Database, eventIds: readonly string[]) {
	if (eventIds.length === 0) {
		return { categories: [], pricingTiers: [], images: [] };
	}

	const categoriesPromise = db
		.select()
		.from(eventCategories)
		.where(inArray(eventCategories.eventId, [...eventIds]))
		.orderBy(eventCategories.eventId, eventCategories.sortOrder);
	const pricingTiersPromise = db
		.select()
		.from(eventPricingTiers)
		.where(inArray(eventPricingTiers.eventId, [...eventIds]))
		.orderBy(eventPricingTiers.eventId, eventPricingTiers.eventCategoryId);
	const imagesPromise = db
		.select()
		.from(eventImages)
		.where(
			and(
				inArray(eventImages.eventId, [...eventIds]),
				sql`${eventImages.status} = 'uploaded'`,
				sql`${eventImages.kind} = 'hero'`,
			),
		)
		.orderBy(
			eventImages.eventId,
			sql`${eventImages.createdAt} DESC`,
			sql`${eventImages.id} DESC`,
		);

	const [categories, pricingTiers, images] = await Promise.all([
		categoriesPromise,
		pricingTiersPromise,
		imagesPromise,
	]);
	return { categories, pricingTiers, images };
}

async function buildCards(
	deps: PublicEventListingDeps,
	rows: readonly EventListingRow[],
): Promise<EventPublicCard[]> {
	const eventIds = rows.map((row) => row.id);
	const { categories, pricingTiers, images } = await selectBatchRows(
		deps.db,
		eventIds,
	);
	const featureFlags = deps.featureFlags ?? DEFAULT_FEATURE_FLAGS;
	const categoriesByEventId = groupByEventId(categories as EventCategoryRow[]);
	const pricingTiersByEventId = groupByEventId(
		pricingTiers as EventPricingTierRow[],
	);
	const latestHeroByEventId = latestImageByEventId(images as EventImageRow[]);

	return Promise.all(
		rows.map(async (event) => {
			const eventCategories = categoriesByEventId.get(event.id) ?? [];
			const categoryById = new Map(
				eventCategories.map((category) => [category.id, category]),
			);
			const publicCategories = eventCategories.map((category) =>
				projectCategoryForPublic(category, deps.log, featureFlags),
			);
			const publicPricingTiers = (pricingTiersByEventId.get(event.id) ?? [])
				.map((tier) => {
					const category = categoryById.get(tier.eventCategoryId);
					if (!category) return null;
					return {
						tier: projectPricingTierForPublic(tier, category, event.currency),
						sortOrder: category.sortOrder,
					};
				})
				.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
				.sort((left, right) => left.sortOrder - right.sortOrder)
				.map((entry) => entry.tier);
			const heroImage = await toPublicImage(
				deps,
				event.slug,
				latestHeroByEventId.get(event.id) ?? null,
			);

			return eventPublicCardSchema.parse({
				slug: event.slug,
				title: event.title,
				startAt: event.startAt.toISOString(),
				endAt: event.endAt.toISOString(),
				timezone: event.timezone,
				city: event.city,
				venueName: event.venueName,
				registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
				registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
				isPaid: event.isPaid,
				heroImage,
				categories: publicCategories,
				pricingTiers: publicPricingTiers,
			});
		}),
	);
}

export async function listPublicEvents(
	deps: PublicEventListingDeps,
	params: PublicEventListingParams,
): Promise<PublicEventListingResult> {
	const { rows, meta } = await selectListingRows(deps, params);
	if (rows.length === 0) {
		return { data: [], meta };
	}
	return { data: await buildCards(deps, rows), meta };
}
