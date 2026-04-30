import { z } from "zod/v4";
import { successResponseSchema } from "./api-response.js";
import { organizerSlugSchema } from "./organizer-slug.js";

/**
 * Public-facing organizer projection.
 *
 * Used in two surfaces:
 *  1. Embedded inside `eventPublicDetailSchema` as the organizer summary on
 *     `/events/:slug` (re-exported as `eventPublicOrganizerSummarySchema`).
 *  2. The standalone `/organizers/:slug` profile page (I-2.3.1).
 *
 * Carries only fields that are safe to expose anonymously. Internal
 * identifiers (`id`, `userId`), contact info (`contactEmail`, `contactName`,
 * `contactPhone`), Razorpay state, verification workflow timestamps, and
 * `createdAt`/`updatedAt` are intentionally omitted.
 *
 * `description` is the organizer's self-authored "about" copy. It is
 * nullable; the API normalizes empty/whitespace-only stored values to
 * `null` and defensively truncates to 2000 characters before parsing
 * (the underlying DB column is unbounded `text`, so untrusted lengths
 * must not be allowed to break the public response).
 */
export const organizerPublicProfileSchema = z.object({
	slug: organizerSlugSchema,
	businessName: z.string().min(1),
	isVerified: z.boolean(),
	city: z.string().min(1),
	description: z.string().max(2000).nullable(),
});

export type OrganizerPublicProfile = z.infer<typeof organizerPublicProfileSchema>;

/**
 * Slug-redirect signal returned when the requested organizer slug is registered
 * as a legacy alias for a different (still publicly readable) organizer slug.
 *
 * Internal identifiers (organizer id, redirect resource id) are intentionally
 * omitted so the public surface never leaks the underlying organizer UUID.
 */
export const organizerPublicSlugRedirectSchema = z.object({
	kind: z.literal("redirect"),
	newSlug: organizerSlugSchema,
});

export type OrganizerPublicSlugRedirect = z.infer<
	typeof organizerPublicSlugRedirectSchema
>;

/**
 * Discriminated union returned by the public organizer lookup endpoint.
 * Either an organizer profile payload (`kind: "organizer"`) or a redirect
 * signal (`kind: "redirect"`) — mirrors the shape of
 * `eventPublicLookupResponseSchema` so loaders can reuse the same control flow.
 */
export const organizerPublicLookupResponseSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("organizer"),
		data: organizerPublicProfileSchema,
	}),
	organizerPublicSlugRedirectSchema,
]);

export type OrganizerPublicLookupResponse = z.infer<
	typeof organizerPublicLookupResponseSchema
>;

/**
 * HTTP envelope wrapping {@link organizerPublicLookupResponseSchema} for the
 * Fastify route response schema (`{ success: true, data: <union> }`).
 */
export const organizerPublicLookupHttpResponseSchema = successResponseSchema(
	organizerPublicLookupResponseSchema,
);

export type OrganizerPublicLookupHttpResponse = z.infer<
	typeof organizerPublicLookupHttpResponseSchema
>;
