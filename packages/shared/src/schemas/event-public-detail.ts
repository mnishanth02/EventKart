import { z } from "zod/v4";
import {
	eventCategorySchema,
	eventCurrencySchema,
	eventImageContentTypeSchema,
	eventImageKindSchema,
	eventSportSchema,
	eventTypeSchema,
} from "../constants/event.js";
import { datetimeSchema } from "./date.js";
import { eventCategorySlugSchema } from "./event-category.js";
import { eventPriceSchema } from "./event-pricing.js";
import { eventSlugSchema } from "./event-slug.js";

/**
 * Public-facing image entry rendered on `/events/:slug`.
 *
 * Intentionally narrower than {@link eventImageSchema}:
 * - No internal `id`, `fileName`, `storageKey`, `uploadedBy`, `status`,
 *   `createdAt`, `updatedAt`.
 * - `url` / `expiresAt` are populated only when storage is available;
 *   when storage is disabled the entire image slot is `null`.
 */
export const eventPublicImageSchema = z.object({
	kind: eventImageKindSchema,
	contentType: eventImageContentTypeSchema,
	url: z.string().url(),
	expiresAt: datetimeSchema,
});

export type EventPublicImage = z.infer<typeof eventPublicImageSchema>;

/**
 * Public organizer summary embedded in the event detail. Carries only
 * fields that are safe to expose anonymously.
 */
export const eventPublicOrganizerSummarySchema = z.object({
	slug: z.string().min(1),
	businessName: z.string().min(1),
	isVerified: z.boolean(),
	city: z.string().min(1),
});

export type EventPublicOrganizerSummary = z.infer<
	typeof eventPublicOrganizerSummarySchema
>;

/**
 * Public category projection — name, slug, distance, and ordering only.
 * Capacity (`spotsTotal`/`spotsRemaining`) is intentionally omitted; it is
 * surfaced separately by I-2.1.9.
 */
export const eventPublicCategorySchema = z.object({
	name: z.string().min(1),
	slug: eventCategorySlugSchema,
	distanceMeters: z.number().int().positive(),
	sortOrder: z.number().int().min(0),
});

export type EventPublicCategory = z.infer<typeof eventPublicCategorySchema>;

/**
 * Public pricing tier — joins to {@link eventPublicCategorySchema} via
 * `categorySlug` so internal category UUIDs are not exposed.
 */
export const eventPublicPricingTierSchema = z.object({
	categorySlug: eventCategorySlugSchema,
	basePrice: eventPriceSchema,
	earlyBirdPrice: eventPriceSchema.nullable(),
	earlyBirdDeadline: datetimeSchema.nullable(),
	currency: eventCurrencySchema,
});

export type EventPublicPricingTier = z.infer<
	typeof eventPublicPricingTierSchema
>;

/**
 * Narrow public projection of an event row used by `/events/:slug`.
 *
 * Excludes internal/operational columns (`id`, `organizerId`, `status`,
 * `publishedAt`, `firstPublishedAt`, `submittedForReviewAt`, `formSchema`,
 * `createdAt`, `updatedAt`).
 */
export const eventPublicDetailSchema = z.object({
	slug: eventSlugSchema,
	title: z.string().min(1),
	description: z.string().min(1),
	eventType: eventTypeSchema,
	sport: eventSportSchema,
	category: eventCategorySchema,
	venueName: z.string().min(1),
	addressLine1: z.string().min(1),
	addressLine2: z.string().nullable(),
	city: z.string().min(1),
	state: z.string().min(1),
	country: z.string().min(1),
	postalCode: z.string().nullable(),
	timezone: z.string().min(1),
	startAt: datetimeSchema,
	endAt: datetimeSchema,
	registrationOpensAt: datetimeSchema.nullable(),
	registrationClosesAt: datetimeSchema.nullable(),
	routeDetails: z.string().min(1),
	refundPolicy: z.string().nullable(),
	cancellationPolicy: z.string().nullable(),
	isPaid: z.boolean(),
	currency: eventCurrencySchema,
	organizer: eventPublicOrganizerSummarySchema,
	heroImage: eventPublicImageSchema.nullable(),
	routeMapImage: eventPublicImageSchema.nullable(),
	categories: z.array(eventPublicCategorySchema),
	pricingTiers: z.array(eventPublicPricingTierSchema),
});

export type EventPublicDetail = z.infer<typeof eventPublicDetailSchema>;

/**
 * Slug-redirect signal returned when the requested slug is registered as a
 * legacy alias for a different (still publicly readable) event slug.
 *
 * Internal identifiers (event id, resource id) are intentionally omitted.
 */
export const eventPublicSlugRedirectSchema = z.object({
	kind: z.literal("redirect"),
	newSlug: eventSlugSchema,
});

export type EventPublicSlugRedirect = z.infer<
	typeof eventPublicSlugRedirectSchema
>;

/**
 * Discriminated union returned by the public lookup endpoint. Either an
 * event detail payload (`kind: "event"`) or a redirect signal
 * (`kind: "redirect"`).
 */
export const eventPublicLookupResponseSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("event"),
		data: eventPublicDetailSchema,
	}),
	eventPublicSlugRedirectSchema,
]);

export type EventPublicLookupResponse = z.infer<
	typeof eventPublicLookupResponseSchema
>;
