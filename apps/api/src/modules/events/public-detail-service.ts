import { and, type Database, eq, inArray, sql } from "@repo/db";
import {
	eventCategories,
	eventImages,
	eventPricingTiers,
	events,
	organizers,
	slugRedirects,
} from "@repo/db/schema";
import {
	eventPublicCardCategorySchema,
	eventPublicCategorySchema,
	eventPublicDetailSchema,
	eventPublicImageSchema,
	eventPublicOrganizerSummarySchema,
	eventPublicPricingTierSchema,
	eventPublicSlugRedirectSchema,
	eventSlugSchema,
	type EventPublicCardCategory,
	type EventPublicDetail,
	type EventPublicImage,
	type EventPublicLookupResponse,
	type EventPublicPricingTier,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import {
	PUBLIC_EVENT_CACHE_KEY_PREFIX,
	singleFlight,
} from "../../lib/cache-stampede.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import {
	StorageUnavailableError,
	type StorageClient,
} from "../../lib/storage.js";
import { truncateNoSurrogateSplit } from "../../lib/text-truncate.js";
import { EVENT_SLUG_RESOURCE_TYPE } from "./service.js";

/**
 * I-2.4.3: Public event detail TTL in the origin Redis single-flight
 * cache. Matches the `s-maxage=60` directive on the SSR'd page so the
 * origin and the CDN have the same freshness window.
 */
const PUBLIC_EVENT_CACHE_TTL_SEC = 60;

const PUBLIC_IMAGE_DOWNLOAD_EXPIRES_IN_SECONDS = 3600;

type EventRow = typeof events.$inferSelect;
export type EventCategoryRow = typeof eventCategories.$inferSelect;
export type EventPricingTierRow = typeof eventPricingTiers.$inferSelect;
export type EventImageRow = typeof eventImages.$inferSelect;
type EventStatusValue = EventRow["status"];

export interface PublicEventDetailDeps {
	db: Database;
	storage: StorageClient;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	featureFlags?: PublicEventFeatureFlags;
	/**
	 * Optional namespaced cache client (`app.redis.cache`). When provided,
	 * `lookupPublicEventBySlug` wraps the success branch in
	 * `singleFlight` (I-2.4.3) so concurrent cache misses don't fan out
	 * into N parallel DB projections. Tests omit this safely — the helper
	 * is a pure pass-through when `cache` is `undefined`.
	 */
	cache?: Redis;
}

export interface PublicEventFeatureFlags {
	/**
	 * When `false` (default), the API projects `capacity: null` for every
	 * category regardless of the stored `spotsTotal`/`spotsRemaining` values.
	 * This keeps the public surface aligned with the web flag
	 * `VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED` so the badge cannot leak
	 * stale capacity to clients before atomic registration decrements ship
	 * (Phase 3, I-3.2.10). Both flags must be `true` for the badge to render.
	 */
	spotsRemainingEnabled: boolean;
}

const DEFAULT_FEATURE_FLAGS: PublicEventFeatureFlags = {
	spotsRemainingEnabled: false,
};

export function projectCategoryForPublic(
	category: EventCategoryRow,
	log: Pick<FastifyBaseLogger, "warn">,
	featureFlags: PublicEventFeatureFlags,
): EventPublicCardCategory {
	const isCapacityWellFormed =
		category.spotsTotal > 0 &&
		category.spotsRemaining >= 0 &&
		category.spotsRemaining <= category.spotsTotal;

	let capacity: { spotsTotal: number; spotsRemaining: number } | null;
	if (!isCapacityWellFormed) {
		capacity = null;
		log.warn(
			{
				eventId: category.eventId,
				categoryId: category.id,
				spotsTotal: category.spotsTotal,
				spotsRemaining: category.spotsRemaining,
			},
			"Invalid public event category capacity; projecting null capacity",
		);
	} else if (!featureFlags.spotsRemainingEnabled) {
		capacity = null;
	} else {
		capacity = {
			spotsTotal: category.spotsTotal,
			spotsRemaining: category.spotsRemaining,
		};
	}

	return eventPublicCardCategorySchema.parse({
		name: category.name,
		slug: category.slug,
		distanceMeters: category.distanceMeters,
		capacity,
	});
}

export function projectPricingTierForPublic(
	tier: EventPricingTierRow,
	category: EventCategoryRow,
	currency: EventRow["currency"],
): EventPublicPricingTier {
	return eventPublicPricingTierSchema.parse({
		categorySlug: category.slug,
		basePrice: tier.basePrice,
		earlyBirdPrice: tier.earlyBirdPrice,
		earlyBirdDeadline: tier.earlyBirdDeadline?.toISOString() ?? null,
		currency,
	});
}

function isPubliclyReadableEventStatus(status: EventStatusValue): boolean {
	return status === "published" || status === "completed";
}

async function selectEventBySlug(
	db: Pick<Database, "select">,
	slug: string,
): Promise<EventRow | undefined> {
	const [event] = await db
		.select()
		.from(events)
		.where(eq(events.slug, slug))
		.limit(1);

	return event;
}

async function selectEventById(
	db: Pick<Database, "select">,
	eventId: string,
): Promise<EventRow | undefined> {
	const [event] = await db
		.select()
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	return event;
}

async function selectOrganizerSummary(
	db: Pick<Database, "select">,
	organizerId: string,
): Promise<EventPublicDetail["organizer"]> {
	const [organizer] = await db
		.select({
			slug: organizers.slug,
			businessName: organizers.businessName,
			isVerified: organizers.isVerified,
			city: organizers.city,
			description: organizers.description,
		})
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	if (!organizer) {
		throw new NotFoundError("Event not found");
	}

	const trimmed = (organizer.description ?? "").trim();
	const description =
		trimmed.length === 0 ? null : truncateNoSurrogateSplit(trimmed, 2000);

	return eventPublicOrganizerSummarySchema.parse({
		slug: organizer.slug,
		businessName: organizer.businessName,
		isVerified: organizer.isVerified,
		city: organizer.city,
		description,
	});
}

async function selectPublicCategories(
	db: Pick<Database, "select">,
	eventId: string,
	log: Pick<FastifyBaseLogger, "warn">,
	featureFlags: PublicEventFeatureFlags,
): Promise<{
	publicCategories: EventPublicDetail["categories"];
	categoryById: Map<string, EventCategoryRow>;
}> {
	const rows = await db
		.select()
		.from(eventCategories)
		.where(eq(eventCategories.eventId, eventId))
		.orderBy(eventCategories.sortOrder);

	return {
		publicCategories: rows.map((category) =>
			eventPublicCategorySchema.parse({
				...projectCategoryForPublic(category, log, featureFlags),
				sortOrder: category.sortOrder,
			}),
		),
		categoryById: new Map(rows.map((category) => [category.id, category])),
	};
}

async function selectPublicPricingTiers(
	db: Pick<Database, "select">,
	event: EventRow,
	categoryById: ReadonlyMap<string, EventCategoryRow>,
): Promise<EventPublicDetail["pricingTiers"]> {
	const rows = await db
		.select()
		.from(eventPricingTiers)
		.where(eq(eventPricingTiers.eventId, event.id))
		.orderBy(eventPricingTiers.eventCategoryId);

	return rows
		.map((tier: EventPricingTierRow) => {
			const category = categoryById.get(tier.eventCategoryId);
			if (!category) return null;

			return {
				...projectPricingTierForPublic(tier, category, event.currency),
				sortOrder: category.sortOrder,
			};
		})
		.filter((tier): tier is NonNullable<typeof tier> => tier !== null)
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map(({ sortOrder: _sortOrder, ...tier }) =>
			eventPublicPricingTierSchema.parse(tier),
		);
}

async function selectLatestPublicImageRows(
	db: Pick<Database, "select">,
	eventId: string,
): Promise<{
	hero: EventImageRow | null;
	routeMap: EventImageRow | null;
}> {
	const rows = await db
		.select()
		.from(eventImages)
		.where(
			and(
				eq(eventImages.eventId, eventId),
				eq(eventImages.status, "uploaded"),
				inArray(eventImages.kind, ["hero", "route_map"]),
			),
		)
		.orderBy(
			eventImages.kind,
			sql`${eventImages.createdAt} DESC`,
			sql`${eventImages.id} DESC`,
		);

	let hero: EventImageRow | null = null;
	let routeMap: EventImageRow | null = null;

	for (const row of rows) {
		if (row.kind === "hero" && hero === null) {
			hero = row;
		}
		if (row.kind === "route_map" && routeMap === null) {
			routeMap = row;
		}
	}

	return { hero, routeMap };
}

export async function toPublicImage(
	deps: PublicEventDetailDeps,
	eventSlug: string,
	row: EventImageRow | null,
): Promise<EventPublicImage | null> {
	if (row === null || !deps.storage.enabled) {
		return null;
	}

	try {
		const download = await deps.storage.getDownloadUrl({
			key: row.storageKey,
			expiresIn: PUBLIC_IMAGE_DOWNLOAD_EXPIRES_IN_SECONDS,
		});

		return eventPublicImageSchema.parse({
			kind: row.kind,
			contentType: row.contentType,
			url: download.url,
			expiresAt: download.expiresAt.toISOString(),
		});
	} catch (err) {
		deps.log.warn({ err, eventSlug }, "Failed to sign public event image URL");
		if (err instanceof StorageUnavailableError) {
			return null;
		}
		throw err;
	}
}

async function buildPublicEventDetail(
	deps: PublicEventDetailDeps,
	event: EventRow,
): Promise<EventPublicDetail> {
	const featureFlags = deps.featureFlags ?? DEFAULT_FEATURE_FLAGS;
	const organizer = await selectOrganizerSummary(deps.db, event.organizerId);
	const { publicCategories, categoryById } = await selectPublicCategories(
		deps.db,
		event.id,
		deps.log,
		featureFlags,
	);
	const pricingTiers = await selectPublicPricingTiers(
		deps.db,
		event,
		categoryById,
	);
	const images = await selectLatestPublicImageRows(deps.db, event.id);
	const [heroImage, routeMapImage] = await Promise.all([
		toPublicImage(deps, event.slug, images.hero),
		toPublicImage(deps, event.slug, images.routeMap),
	]);

	return eventPublicDetailSchema.parse({
		slug: event.slug,
		title: event.title,
		description: event.description,
		eventType: event.eventType,
		sport: event.sport,
		category: event.category,
		venueName: event.venueName,
		addressLine1: event.addressLine1,
		addressLine2: event.addressLine2,
		city: event.city,
		state: event.state,
		country: event.country,
		postalCode: event.postalCode,
		timezone: event.timezone,
		startAt: event.startAt.toISOString(),
		endAt: event.endAt.toISOString(),
		registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
		registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
		routeDetails: event.routeDetails,
		refundPolicy: event.refundPolicy ?? null,
		cancellationPolicy: event.cancellationPolicy ?? null,
		isPaid: event.isPaid,
		currency: event.currency,
		organizer,
		heroImage,
		routeMapImage,
		categories: publicCategories,
		pricingTiers,
	});
}

/**
 * Resolve a slug-redirect row for the event namespace. Throws
 * `NotFoundError` (which the caller surfaces as 404) when:
 *  - no redirect row exists,
 *  - the redirect target points back at the requested slug (loop guard),
 *  - the target event row is missing,
 *  - the target event is not publicly readable (e.g. draft / unpublished),
 *    OR
 *  - the target event's current slug no longer matches `redirect.newSlug`
 *    (the redirect is stale relative to the events table — typically a
 *    chained rename A → B → C, where the redirect row says B but the
 *    canonical slug has already moved to C). Issuing a 301 to B in that
 *    case would send the client to a slug that no longer exists,
 *    forcing an extra 404 round-trip and (at the CDN) potentially
 *    poisoning the redirect cache.
 *
 * Mirrors `lookupOrganizerSlugRedirect` so both public lookup paths
 * enforce the same chained-rename invariant. See I-2.4.6.
 */
async function lookupSlugRedirect(
	deps: PublicEventDetailDeps,
	slug: string,
): Promise<EventPublicLookupResponse> {
	const [redirect] = await deps.db
		.select({
			resourceId: slugRedirects.resourceId,
			newSlug: slugRedirects.newSlug,
		})
		.from(slugRedirects)
		.where(
			and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
			),
		)
		.limit(1);

	if (!redirect || redirect.newSlug === slug) {
		throw new NotFoundError("Event not found");
	}

	const targetEvent = await selectEventById(deps.db, redirect.resourceId);
	if (
		!targetEvent ||
		!isPubliclyReadableEventStatus(targetEvent.status) ||
		targetEvent.slug !== redirect.newSlug
	) {
		throw new NotFoundError("Event not found");
	}

	return eventPublicSlugRedirectSchema.parse({
		kind: "redirect",
		newSlug: redirect.newSlug,
	});
}

/**
 * Producer for the I-2.4.3 single-flight cache. Returns the projected
 * detail on hit, or `null` when no event row matches the slug. The
 * `null` branch is cached for {@link PUBLIC_EVENT_CACHE_TTL_SEC} so a
 * burst of invalid-slug spam can't stampede the DB; the redirect
 * fallback (which mutates a different table) still runs every request
 * so legitimate slug renames keep working.
 *
 * `NotFoundError` from the draft/unpublished branch is propagated and
 * NEVER cached — caching a 404 for a slug that's about to be published
 * would briefly hide a legitimate event.
 */
async function fetchPublicEventBySlug(
	deps: PublicEventDetailDeps,
	slug: string,
): Promise<EventPublicDetail | null> {
	const event = await selectEventBySlug(deps.db, slug);
	if (!event) {
		return null;
	}
	if (!isPubliclyReadableEventStatus(event.status)) {
		throw new NotFoundError("Event not found");
	}
	return buildPublicEventDetail(deps, event);
}

export async function lookupPublicEventBySlug(
	deps: PublicEventDetailDeps,
	slug: string,
): Promise<EventPublicLookupResponse> {
	const parsed = eventSlugSchema.safeParse(slug);
	if (!parsed.success) {
		throw new ValidationError("Invalid event slug");
	}

	const cache = deps.cache;
	const data = cache
		? await singleFlight<EventPublicDetail | null>(
				cache,
				`${PUBLIC_EVENT_CACHE_KEY_PREFIX}${parsed.data}`,
				PUBLIC_EVENT_CACHE_TTL_SEC,
				() => fetchPublicEventBySlug(deps, parsed.data),
			)
		: await fetchPublicEventBySlug(deps, parsed.data);

	if (data !== null) {
		return { kind: "event", data };
	}

	return lookupSlugRedirect(deps, parsed.data);
}
