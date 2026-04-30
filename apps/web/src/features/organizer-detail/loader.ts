import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { ORGANIZER_DETAIL_CACHE_CONTROL } from "./cache-headers";
import { publicOrganizerQueryOptions } from "./queries";
import type {
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
} from "./types";

export interface ResolvePublicOrganizerLoaderArgs {
	slug: string;
	queryClient: QueryClient;
	setResponseHeaders?: (headers: Headers) => void | Promise<void>;
}

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
 * Mirrors `resolvePublicEventLoader` so behavior is consistent across
 * the two SSR-cached public routes.
 */
export async function resolvePublicOrganizerLoader({
	slug,
	queryClient,
	setResponseHeaders,
}: ResolvePublicOrganizerLoaderArgs): Promise<OrganizerPublicProfile> {
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

	if (setResponseHeaders) {
		await setResponseHeaders(
			new Headers({ "Cache-Control": ORGANIZER_DETAIL_CACHE_CONTROL }),
		);
	}

	return payload.data;
}

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status?: unknown }).status === status
	);
}
