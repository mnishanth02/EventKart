import { type Database, eq } from "@repo/db";
import { organizers } from "@repo/db/schema";
import type { EventPublicCard } from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { StorageClient } from "../../lib/storage.js";
import {
	listPublicEvents,
} from "../events/public-listing-service.js";
import type { PublicEventFeatureFlags } from "../events/public-detail-service.js";

export interface OrganizerNextEventDeps {
	db: Database;
	storage: StorageClient;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	featureFlags?: PublicEventFeatureFlags;
}

export interface OrganizerNextEventParams {
	organizerId: string;
	now: Date;
}

/**
 * Fetch the immediate next published event for a given organizer
 * (I-2.3.6). Returns `null` when the organizer exists but has no
 * upcoming event; throws `null` is NOT used to signal "organizer
 * missing" — the route layer probes existence first to keep the
 * "wrong organizer" vs "no next event" distinction explicit (see
 * `getOrganizerNextEvent`).
 *
 * Reuses `listPublicEvents` from the events module so projection
 * (categories, pricing, hero image, feature flags) and time/status
 * predicates stay identical to the public listing surface — single
 * source of truth for "public event card".
 */
export async function selectOrganizerNextEvent(
	deps: OrganizerNextEventDeps,
	{ organizerId, now }: OrganizerNextEventParams,
): Promise<EventPublicCard | null> {
	const result = await listPublicEvents(deps, {
		page: 1,
		limit: 1,
		sort: "startAtAsc",
		timeWindow: "upcoming",
		now,
		organizerId,
	});
	return result.data[0] ?? null;
}

/**
 * Verify an organizer row exists for the given UUID. Used by the
 * `next-event` route so a missing organizer surfaces as 404 rather
 * than a silent `data: null` response (which would be confusable with
 * "organizer exists but has no upcoming event").
 */
export async function organizerExistsById(
	db: Pick<Database, "select">,
	organizerId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: organizers.id })
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);
	return row !== undefined;
}
