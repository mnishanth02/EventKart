import { and, type Database, eq, ne } from "@repo/db";
import { events, slugRedirects } from "@repo/db/schema";
import type { EventSlug } from "@repo/shared/schemas";
import { eventSlugSchema } from "@repo/shared/schemas";
import { appendEventSlugSuffix, normalizeEventSlug } from "@repo/shared/utils";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

export const EVENT_SLUG_RESOURCE_TYPE = "event";
export const DEFAULT_EVENT_SLUG_MAX_ATTEMPTS = 50;

export type EventSlugStore = Pick<
	Database,
	"delete" | "insert" | "select" | "update"
>;

export interface EventSlugTransactionalStore extends EventSlugStore {
	transaction: Database["transaction"];
}

export interface ReserveEventSlugOptions {
	excludeEventId?: string;
	maxAttempts?: number;
}

export interface EventSlugRedirectInput {
	eventId: string;
	oldSlug: string;
	newSlug: string;
}

export interface EventSlugRedirectResult {
	recorded: boolean;
}

export interface UpdateEventSlugInput {
	eventId: string;
	slugCandidate: string;
	currentSlug?: string;
}

export interface UpdateEventSlugResult {
	changed: boolean;
	previousSlug: EventSlug;
	slug: EventSlug;
}

function parseEventSlug(slug: string): EventSlug {
	return eventSlugSchema.parse(slug);
}

function getMaxAttempts(maxAttempts = DEFAULT_EVENT_SLUG_MAX_ATTEMPTS): number {
	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
		throw new RangeError("Slug maxAttempts must be a positive safe integer.");
	}

	return maxAttempts;
}

function buildSlugCandidate(baseSlug: string, attempt: number): EventSlug {
	const candidate =
		attempt === 1 ? baseSlug : appendEventSlugSuffix(baseSlug, attempt);

	return parseEventSlug(candidate);
}

async function slugExists(
	db: EventSlugStore,
	slug: EventSlug,
	options: Pick<ReserveEventSlugOptions, "excludeEventId">,
): Promise<boolean> {
	const activeSlugWhere = options.excludeEventId
		? and(eq(events.slug, slug), ne(events.id, options.excludeEventId))
		: eq(events.slug, slug);

	const activeMatches = await db
		.select({ id: events.id })
		.from(events)
		.where(activeSlugWhere)
		.limit(1);

	if (activeMatches.length > 0) return true;

	const redirectWhere = options.excludeEventId
		? and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
				ne(slugRedirects.resourceId, options.excludeEventId),
			)
		: and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
			);

	const redirectMatches = await db
		.select({ id: slugRedirects.id })
		.from(slugRedirects)
		.where(redirectWhere)
		.limit(1);

	return redirectMatches.length > 0;
}

export async function reserveUniqueEventSlug(
	db: EventSlugStore,
	slugCandidate: string,
	options: ReserveEventSlugOptions = {},
): Promise<EventSlug> {
	const maxAttempts = getMaxAttempts(options.maxAttempts);
	const baseSlug = normalizeEventSlug(slugCandidate);

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const candidate = buildSlugCandidate(baseSlug, attempt);

		if (!(await slugExists(db, candidate, options))) {
			return candidate;
		}
	}

	throw new ConflictError(
		`Unable to reserve a unique event slug after ${maxAttempts} attempts`,
	);
}

export async function generateUniqueEventSlug(
	db: EventSlugStore,
	slugCandidate: string,
	options: ReserveEventSlugOptions = {},
): Promise<EventSlug> {
	return reserveUniqueEventSlug(db, slugCandidate, options);
}

export async function recordEventSlugRedirect(
	db: EventSlugStore,
	input: EventSlugRedirectInput,
): Promise<EventSlugRedirectResult> {
	const oldSlug = parseEventSlug(input.oldSlug);
	const newSlug = parseEventSlug(input.newSlug);

	if (oldSlug === newSlug) {
		return { recorded: false };
	}

	await db
		.delete(slugRedirects)
		.where(
			and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.eventId),
				eq(slugRedirects.oldSlug, newSlug),
			),
		);

	await db
		.update(slugRedirects)
		.set({ newSlug })
		.where(
			and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.eventId),
				eq(slugRedirects.newSlug, oldSlug),
			),
		);

	await db
		.insert(slugRedirects)
		.values({
			oldSlug,
			newSlug,
			resourceType: EVENT_SLUG_RESOURCE_TYPE,
			resourceId: input.eventId,
		})
		.onConflictDoUpdate({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug,
				resourceId: input.eventId,
			},
		});

	return { recorded: true };
}

async function getCurrentEventSlug(
	db: EventSlugStore,
	eventId: string,
): Promise<EventSlug> {
	const [event] = await db
		.select({ slug: events.slug })
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	return parseEventSlug(event.slug);
}

export async function updateEventSlug(
	db: EventSlugTransactionalStore,
	input: UpdateEventSlugInput,
	options: ReserveEventSlugOptions = {},
): Promise<UpdateEventSlugResult> {
	return db.transaction(async (tx) => {
		const currentSlug = input.currentSlug
			? parseEventSlug(input.currentSlug)
			: await getCurrentEventSlug(tx, input.eventId);
		const newSlug = await reserveUniqueEventSlug(tx, input.slugCandidate, {
			...options,
			excludeEventId: input.eventId,
		});

		if (currentSlug === newSlug) {
			return {
				changed: false,
				previousSlug: currentSlug,
				slug: currentSlug,
			};
		}

		const [updated] = await tx
			.update(events)
			.set({ slug: newSlug })
			.where(eq(events.id, input.eventId))
			.returning({ slug: events.slug });

		if (!updated) {
			throw new NotFoundError("Event not found");
		}

		const updatedSlug = parseEventSlug(updated.slug);
		await recordEventSlugRedirect(tx, {
			eventId: input.eventId,
			oldSlug: currentSlug,
			newSlug: updatedSlug,
		});

		return {
			changed: true,
			previousSlug: currentSlug,
			slug: updatedSlug,
		};
	});
}
