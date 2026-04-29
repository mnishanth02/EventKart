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
	eventPublicDetailSchema,
	eventPublicCategorySchema,
	eventPublicImageSchema,
	eventPublicOrganizerSummarySchema,
	eventPublicPricingTierSchema,
	eventPublicSlugRedirectSchema,
	eventSlugSchema,
	type EventPublicDetail,
	type EventPublicImage,
	type EventPublicLookupResponse,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import {
	StorageUnavailableError,
	type StorageClient,
} from "../../lib/storage.js";
import { EVENT_SLUG_RESOURCE_TYPE } from "./service.js";

const PUBLIC_IMAGE_DOWNLOAD_EXPIRES_IN_SECONDS = 3600;

type EventRow = typeof events.$inferSelect;
type EventCategoryRow = typeof eventCategories.$inferSelect;
type EventPricingTierRow = typeof eventPricingTiers.$inferSelect;
type EventImageRow = typeof eventImages.$inferSelect;
type EventStatusValue = EventRow["status"];

export interface PublicEventDetailDeps {
	db: Database;
	storage: StorageClient;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
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

/**
 * Truncate `value` to at most `maxCodeUnits` UTF-16 code units while never
 * leaving an unpaired high surrogate at the tail.
 *
 * `String.prototype.slice` is code-unit-based, so slicing in the middle of a
 * surrogate pair (e.g. an emoji or any astral-plane code point) yields a
 * dangling high surrogate that renders as a replacement glyph downstream.
 * For a pessimistic public-event-detail boundary we accept losing one full
 * astral code point in that edge case.
 */
function truncateNoSurrogateSplit(value: string, maxCodeUnits: number): string {
	if (value.length <= maxCodeUnits) {
		return value;
	}
	const sliced = value.slice(0, maxCodeUnits);
	const lastCodeUnit = sliced.charCodeAt(sliced.length - 1);
	// 0xD800–0xDBFF is the high-surrogate range; if the boundary lands there
	// we drop it so the truncated string remains well-formed UTF-16.
	if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
		return sliced.slice(0, -1);
	}
	return sliced;
}

async function selectPublicCategories(
	db: Pick<Database, "select">,
	eventId: string,
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
				name: category.name,
				slug: category.slug,
				distanceMeters: category.distanceMeters,
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
				categorySlug: category.slug,
				basePrice: tier.basePrice,
				earlyBirdPrice: tier.earlyBirdPrice,
				earlyBirdDeadline: tier.earlyBirdDeadline?.toISOString() ?? null,
				currency: event.currency,
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

async function toPublicImage(
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
	const organizer = await selectOrganizerSummary(deps.db, event.organizerId);
	const { publicCategories, categoryById } = await selectPublicCategories(
		deps.db,
		event.id,
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
	if (!targetEvent || !isPubliclyReadableEventStatus(targetEvent.status)) {
		throw new NotFoundError("Event not found");
	}

	return eventPublicSlugRedirectSchema.parse({
		kind: "redirect",
		newSlug: redirect.newSlug,
	});
}

export async function lookupPublicEventBySlug(
	deps: PublicEventDetailDeps,
	slug: string,
): Promise<EventPublicLookupResponse> {
	const parsed = eventSlugSchema.safeParse(slug);
	if (!parsed.success) {
		throw new ValidationError("Invalid event slug");
	}

	const event = await selectEventBySlug(deps.db, parsed.data);
	if (event) {
		if (!isPubliclyReadableEventStatus(event.status)) {
			throw new NotFoundError("Event not found");
		}

		return {
			kind: "event",
			data: await buildPublicEventDetail(deps, event),
		};
	}

	return lookupSlugRedirect(deps, parsed.data);
}
