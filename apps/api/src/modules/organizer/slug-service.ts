import type { Database } from "@repo/db";
import { and, eq, ne } from "@repo/db";
import { organizers, slugRedirects } from "@repo/db/schema";
import {
	ORGANIZER_SLUG_FALLBACK,
	ORGANIZER_SLUG_MAX_LENGTH,
	RESERVED_ORGANIZER_SLUGS,
} from "@repo/shared/constants";
import { appendSlugSuffix, normalizeSlug } from "@repo/shared/utils";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

export const ORGANIZER_SLUG_RESOURCE_TYPE = "organizer";
export const DEFAULT_ORGANIZER_SLUG_MAX_ATTEMPTS = 50;

export type OrganizerSlugStore = Pick<
	Database,
	"delete" | "insert" | "select" | "update"
>;

export interface ReserveOrganizerSlugOptions {
	excludeOrganizerId?: string;
	maxAttempts?: number;
}

export interface OrganizerSlugRedirectInput {
	organizerId: string;
	oldSlug: string;
	newSlug: string;
}

const RESERVED_SET: ReadonlySet<string> = new Set(RESERVED_ORGANIZER_SLUGS);

export function isReservedOrganizerSlug(slug: string): boolean {
	return RESERVED_SET.has(slug.toLowerCase());
}

function buildOrganizerSlugCandidate(
	baseSlug: string,
	attempt: number,
): string {
	if (attempt === 1) return baseSlug;
	return appendSlugSuffix(baseSlug, attempt, {
		fallback: ORGANIZER_SLUG_FALLBACK,
		maxLength: ORGANIZER_SLUG_MAX_LENGTH,
	});
}

async function organizerSlugExists(
	db: OrganizerSlugStore,
	slug: string,
	options: Pick<ReserveOrganizerSlugOptions, "excludeOrganizerId">,
): Promise<boolean> {
	const activeWhere = options.excludeOrganizerId
		? and(
				eq(organizers.slug, slug),
				ne(organizers.id, options.excludeOrganizerId),
			)
		: eq(organizers.slug, slug);

	const matches = await db
		.select({ id: organizers.id })
		.from(organizers)
		.where(activeWhere)
		.limit(1);

	if (matches.length > 0) return true;

	const redirectWhere = options.excludeOrganizerId
		? and(
				eq(slugRedirects.resourceType, ORGANIZER_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
				ne(slugRedirects.resourceId, options.excludeOrganizerId),
			)
		: and(
				eq(slugRedirects.resourceType, ORGANIZER_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
			);

	const redirects = await db
		.select({ id: slugRedirects.id })
		.from(slugRedirects)
		.where(redirectWhere)
		.limit(1);

	return redirects.length > 0;
}

function getMaxAttempts(
	maxAttempts = DEFAULT_ORGANIZER_SLUG_MAX_ATTEMPTS,
): number {
	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
		throw new RangeError("Slug maxAttempts must be a positive safe integer.");
	}
	return maxAttempts;
}

/**
 * Reserve a unique organizer slug. Reserved names are skipped automatically.
 * Returns the candidate slug; the caller is responsible for inserting it.
 */
export async function reserveUniqueOrganizerSlug(
	db: OrganizerSlugStore,
	candidate: string,
	options: ReserveOrganizerSlugOptions = {},
): Promise<string> {
	const maxAttempts = getMaxAttempts(options.maxAttempts);
	const baseSlug = normalizeSlug(candidate, {
		fallback: ORGANIZER_SLUG_FALLBACK,
		maxLength: ORGANIZER_SLUG_MAX_LENGTH,
	});

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const slug = buildOrganizerSlugCandidate(baseSlug, attempt);
		if (isReservedOrganizerSlug(slug)) continue;
		if (!(await organizerSlugExists(db, slug, options))) return slug;
	}

	throw new ConflictError(
		`Unable to reserve a unique organizer slug after ${maxAttempts} attempts`,
	);
}

/** Alias for symmetry with event slug API. */
export async function generateUniqueOrganizerSlug(
	db: OrganizerSlugStore,
	candidate: string,
	options: ReserveOrganizerSlugOptions = {},
): Promise<string> {
	return reserveUniqueOrganizerSlug(db, candidate, options);
}

/**
 * Record an organizer slug redirect when an organizer renames their public slug.
 */
export async function recordOrganizerSlugRedirect(
	db: OrganizerSlugStore,
	input: OrganizerSlugRedirectInput,
): Promise<{ recorded: boolean }> {
	if (input.oldSlug === input.newSlug) return { recorded: false };

	await db
		.delete(slugRedirects)
		.where(
			and(
				eq(slugRedirects.resourceType, ORGANIZER_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.organizerId),
				eq(slugRedirects.oldSlug, input.newSlug),
			),
		);

	await db
		.update(slugRedirects)
		.set({ newSlug: input.newSlug })
		.where(
			and(
				eq(slugRedirects.resourceType, ORGANIZER_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.organizerId),
				eq(slugRedirects.newSlug, input.oldSlug),
			),
		);

	await db
		.insert(slugRedirects)
		.values({
			oldSlug: input.oldSlug,
			newSlug: input.newSlug,
			resourceType: ORGANIZER_SLUG_RESOURCE_TYPE,
			resourceId: input.organizerId,
		})
		.onConflictDoUpdate({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug: input.newSlug,
				resourceId: input.organizerId,
			},
		});

	return { recorded: true };
}

/**
 * Helper for an explicit organizer rename — atomically reserves a new slug,
 * updates the organizer row, and records a redirect.
 */
export async function renameOrganizerSlug(
	db: Database,
	organizerId: string,
	newSlugCandidate: string,
): Promise<{ slug: string; previousSlug: string | null }> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ slug: organizers.slug })
			.from(organizers)
			.where(eq(organizers.id, organizerId))
			.limit(1);

		if (!current) {
			throw new NotFoundError("Organizer not found");
		}

		const previousSlug = current.slug ?? null;
		const newSlug = await reserveUniqueOrganizerSlug(tx, newSlugCandidate, {
			excludeOrganizerId: organizerId,
		});

		if (previousSlug === newSlug) {
			return { slug: newSlug, previousSlug };
		}

		await tx
			.update(organizers)
			.set({ slug: newSlug })
			.where(eq(organizers.id, organizerId));

		if (previousSlug) {
			await recordOrganizerSlugRedirect(tx, {
				organizerId,
				oldSlug: previousSlug,
				newSlug,
			});
		}

		return { slug: newSlug, previousSlug };
	});
}
