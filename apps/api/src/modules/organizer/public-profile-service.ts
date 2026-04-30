import { and, type Database, eq } from "@repo/db";
import { organizers, slugRedirects } from "@repo/db/schema";
import {
	type OrganizerPublicLookupResponse,
	type OrganizerPublicProfile,
	type OrganizerPublicSlugRedirect,
	organizerPublicProfileSchema,
	organizerPublicSlugRedirectSchema,
	organizerSlugSchema,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import {
	PUBLIC_ORGANIZER_CACHE_KEY_PREFIX,
	singleFlight,
} from "../../lib/cache-stampede.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { truncateNoSurrogateSplit } from "../../lib/text-truncate.js";
import { ORGANIZER_SLUG_RESOURCE_TYPE } from "./slug-service.js";

const PUBLIC_DESCRIPTION_MAX_CODE_UNITS = 2000;

/**
 * I-2.4.3: TTL for the origin Redis single-flight cache around the
 * `/organizers/by-slug/:slug` projection. Mirrors the SSR `s-maxage=60`.
 */
const PUBLIC_ORGANIZER_CACHE_TTL_SEC = 60;

interface PublicOrganizerRow {
	id: string;
	slug: string;
	businessName: string;
	city: string;
	description: string | null;
	isVerified: boolean;
}

const PUBLIC_ORGANIZER_COLUMNS = {
	id: organizers.id,
	slug: organizers.slug,
	businessName: organizers.businessName,
	city: organizers.city,
	description: organizers.description,
	isVerified: organizers.isVerified,
} as const;

async function selectOrganizerBySlug(
	db: Pick<Database, "select">,
	slug: string,
): Promise<PublicOrganizerRow | null> {
	const [row] = await db
		.select(PUBLIC_ORGANIZER_COLUMNS)
		.from(organizers)
		.where(eq(organizers.slug, slug))
		.limit(1);

	return row ?? null;
}

async function selectOrganizerById(
	db: Pick<Database, "select">,
	id: string,
): Promise<PublicOrganizerRow | null> {
	const [row] = await db
		.select(PUBLIC_ORGANIZER_COLUMNS)
		.from(organizers)
		.where(eq(organizers.id, id))
		.limit(1);

	return row ?? null;
}

/**
 * Pure projection: trims the description, normalizes empty/whitespace to
 * `null`, and defensively truncates to the 2000-code-unit public bound
 * before parsing through the shared schema. The schema strips any extra
 * fields, so this also acts as a PII-leak guard if the row shape drifts.
 */
function selectPublicOrganizerProfile(
	organizer: PublicOrganizerRow,
): OrganizerPublicProfile {
	const trimmed = (organizer.description ?? "").trim();
	const description =
		trimmed.length === 0
			? null
			: truncateNoSurrogateSplit(trimmed, PUBLIC_DESCRIPTION_MAX_CODE_UNITS);

	return organizerPublicProfileSchema.parse({
		slug: organizer.slug,
		businessName: organizer.businessName,
		isVerified: organizer.isVerified,
		city: organizer.city,
		description,
	});
}

/**
 * Resolve a slug-redirect row for the organizer namespace. Returns `null`
 * (which the caller surfaces as 404) when:
 *  - no redirect row exists,
 *  - the redirect target points back at the requested slug (loop guard),
 *  - the target organizer row is missing, or
 *  - the target organizer's current slug no longer matches `redirect.newSlug`
 *    (the redirect is stale relative to the organizer table).
 */
async function lookupOrganizerSlugRedirect(
	db: Pick<Database, "select">,
	slug: string,
): Promise<OrganizerPublicSlugRedirect | null> {
	const [redirect] = await db
		.select({
			resourceId: slugRedirects.resourceId,
			newSlug: slugRedirects.newSlug,
		})
		.from(slugRedirects)
		.where(
			and(
				eq(slugRedirects.resourceType, ORGANIZER_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
			),
		)
		.limit(1);

	if (!redirect || redirect.newSlug === slug) {
		return null;
	}

	const target = await selectOrganizerById(db, redirect.resourceId);
	if (!target || target.slug !== redirect.newSlug) {
		return null;
	}

	return organizerPublicSlugRedirectSchema.parse({
		kind: "redirect",
		newSlug: redirect.newSlug,
	});
}

/**
 * Producer for the I-2.4.3 single-flight cache. Returns the projected
 * profile, or `null` when no organizer row matches. The redirect path
 * runs separately so caching `null` cannot mask a fresh slug rename.
 */
async function fetchPublicOrganizerProfile(
	db: Pick<Database, "select">,
	slug: string,
): Promise<OrganizerPublicProfile | null> {
	const organizer = await selectOrganizerBySlug(db, slug);
	if (!organizer) {
		return null;
	}
	return selectPublicOrganizerProfile(organizer);
}

/**
 * Public lookup for `/api/v1/organizers/by-slug/:slug`.
 *
 * Mirrors `lookupPublicEventBySlug` so route loaders can share the
 * `kind: "organizer" | "redirect"` control flow:
 *  1. Validate the raw slug (throws `ValidationError` on a malformed
 *     input — surfaced as 400).
 *  2. Look up by current slug. Hit → return the projected profile.
 *  3. Otherwise look up the slug-redirect table; honour only verified
 *     redirects whose target organizer still exists and matches.
 *  4. Otherwise throw `NotFoundError` (404).
 *
 * I-2.4.3: When `cache` (the namespaced `app.redis.cache` client) is
 * supplied, step 2 runs through `singleFlight` so concurrent cache
 * misses share one DB roundtrip. The redirect lookup (step 3) is
 * intentionally NOT cached — a stale redirect could outlive a chained
 * rename window (see `lookupOrganizerSlugRedirect` for the invariant).
 */
export async function lookupPublicOrganizerBySlug(
	db: Pick<Database, "select">,
	rawSlug: string,
	_log: Pick<FastifyBaseLogger, "info" | "warn">,
	cache?: Redis,
): Promise<OrganizerPublicLookupResponse> {
	const parsed = organizerSlugSchema.safeParse(rawSlug);
	if (!parsed.success) {
		throw new ValidationError("Invalid organizer slug", {
			slug: parsed.error.issues.map((issue) => issue.message),
		});
	}

	const slug = parsed.data;
	const profile = cache
		? await singleFlight<OrganizerPublicProfile | null>(
				cache,
				`${PUBLIC_ORGANIZER_CACHE_KEY_PREFIX}${slug}`,
				PUBLIC_ORGANIZER_CACHE_TTL_SEC,
				() => fetchPublicOrganizerProfile(db, slug),
			)
		: await fetchPublicOrganizerProfile(db, slug);

	if (profile) {
		return { kind: "organizer", data: profile };
	}

	const redirect = await lookupOrganizerSlugRedirect(db, slug);
	if (redirect) {
		return redirect;
	}

	throw new NotFoundError("Organizer not found");
}
