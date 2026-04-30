import type { EventPublicCard } from "@repo/shared/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { ORGANIZER_DETAIL_CACHE_CONTROL } from "./cache-headers";
import { publicOrganizerQueryOptions } from "./queries";
import type {
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
} from "./types";
import { organizerUpcomingEventsQueryOptions } from "./upcoming-events-queries";

export interface ResolvePublicOrganizerLoaderArgs {
	slug: string;
	queryClient: QueryClient;
	setResponseHeaders?: (headers: Headers) => void | Promise<void>;
}

export interface PublicOrganizerLoaderData {
	profile: OrganizerPublicProfile;
	events: EventPublicCard[];
}

const UPCOMING_EVENTS_LIMIT = 12;

/**
 * Loader for the public organizer profile route.
 *
 * Resolves the lookup union from the API:
 *  - `kind: "organizer"` → returns the profile and (during SSR) writes
 *    the CDN cache headers.
 *  - `kind: "redirect"` → throws a permanent (`code: 301`) TanStack
 *    redirect to the canonical `/organizers/$slug` route with the new
 *    slug. `replace: true` keeps the legacy URL out of the back-button
 *    history.
 *  - 404 from the API → throws a TanStack `notFound()` so the route
 *    error/notFound boundary can render the standard 404 surface.
 *
 * After the profile resolves successfully (i.e. neither redirect nor
 * notFound), prefetches the organizer's upcoming events list (I-2.3.2)
 * via `ensureQueryData`. If that fetch fails for any reason the error
 * is intentionally swallowed and an empty `events` array is returned —
 * a transient backend failure must not 500 the whole organizer page.
 *
 * Mirrors `resolvePublicEventLoader` so behavior is consistent across
 * the two SSR-cached public routes.
 */
export async function resolvePublicOrganizerLoader({
	slug,
	queryClient,
	setResponseHeaders,
}: ResolvePublicOrganizerLoaderArgs): Promise<PublicOrganizerLoaderData> {
	let payload: OrganizerPublicLookupResponse;
	try {
		payload = await queryClient.ensureQueryData(
			publicOrganizerQueryOptions(slug),
		);
	} catch (error) {
		if (hasStatus(error, 404)) {
			throw notFound();
		}
		throw error;
	}

	if (payload.kind === "redirect") {
		throw redirect({
			to: "/organizers/$slug",
			params: { slug: payload.newSlug },
			replace: true,
			code: 301,
		});
	}

	const profile = payload.data;

	const events = await fetchUpcomingEventsResilient(queryClient, profile.slug);

	if (setResponseHeaders) {
		await setResponseHeaders(
			new Headers({ "Cache-Control": ORGANIZER_DETAIL_CACHE_CONTROL }),
		);
	}

	return { profile, events };
}

async function fetchUpcomingEventsResilient(
	queryClient: QueryClient,
	organizerSlug: string,
): Promise<EventPublicCard[]> {
	try {
		const envelope = await queryClient.ensureQueryData(
			organizerUpcomingEventsQueryOptions({
				organizerSlug,
				page: 1,
				limit: UPCOMING_EVENTS_LIMIT,
				sort: "startAtAsc",
			}),
		);
		return envelope.data;
	} catch (error) {
		console.warn(
			"[organizer-detail] upcoming events fetch failed; rendering empty list",
			error,
		);
		return [];
	}
}

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status?: unknown }).status === status
	);
}
