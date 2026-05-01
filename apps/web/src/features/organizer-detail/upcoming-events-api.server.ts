import type {
	EventPublicCard,
	OffsetPaginationMeta,
} from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";

export interface UpcomingEventsParams {
	organizerSlug: string;
	page: number;
	limit: number;
	sort: "startAtAsc" | "startAtDesc";
}

export interface UpcomingEventsApiEnvelope {
	success: true;
	data: EventPublicCard[];
	meta: OffsetPaginationMeta;
}

/**
 * SSR-only fetch for an organizer's upcoming public events (I-2.3.2).
 *
 * Calls `GET /api/v1/events/public?organizerSlug=<slug>&...` via the
 * internal API client. The backend filters the standard public event
 * list by organizer slug; an unknown slug produces an empty `data` and
 * `meta.total === 0` rather than a 404, so this helper never needs to
 * branch on a not-found case.
 *
 * Errors are intentionally re-thrown unchanged: callers (typically the
 * route loader) decide whether a transient failure should swallow into
 * an empty list or propagate.
 */
export async function getOrganizerUpcomingEventsOnServer({
	organizerSlug,
	page,
	limit,
	sort,
}: UpcomingEventsParams): Promise<UpcomingEventsApiEnvelope> {
	const search = new URLSearchParams({
		organizerSlug,
		page: String(page),
		limit: String(limit),
		sort,
	});
	return serverApiClient<UpcomingEventsApiEnvelope>(
		`/events/public?${search.toString()}`,
	);
}
