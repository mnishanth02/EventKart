import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { PUBLIC_EVENT_CACHE_CONTROL } from "./cache-headers";
import { publicEventQueryOptions } from "./queries";
import type { EventPublicDetail, EventPublicLookupResponse } from "./types";

export type PublicEventRedirectTarget =
	| "/events/$slug"
	| "/events/$slug/register";

/**
 * Cache directive applied to the 301 slug-rename Response. Short, plain
 * `max-age` (no `s-maxage`/`stale-while-revalidate`) so a freshly-renamed
 * slug doesn't get pinned at the CDN edge: a follow-up rename (A → B → C)
 * needs the redirect to invalidate quickly. See I-2.4.6 design notes.
 */
export const PUBLIC_EVENT_REDIRECT_CACHE_CONTROL = "public, max-age=300";

export interface ResolvePublicEventLoaderArgs {
	slug: string;
	queryClient: QueryClient;
	setResponseHeaders?: (headers: Headers) => void | Promise<void>;
	/**
	 * The route to 301-redirect a slug-rename payload to. Defaults to the
	 * canonical event detail page. Callers that live under a child route
	 * (e.g. `/events/$slug/register`) should pass their own target so a
	 * renamed slug preserves the user's original intent rather than
	 * dropping them on the detail page.
	 */
	redirectTo?: PublicEventRedirectTarget;
}

export async function resolvePublicEventLoader({
	slug,
	queryClient,
	setResponseHeaders,
	redirectTo = "/events/$slug",
}: ResolvePublicEventLoaderArgs): Promise<EventPublicDetail> {
	let payload: EventPublicLookupResponse;
	try {
		payload = await queryClient.ensureQueryData(publicEventQueryOptions(slug));
	} catch (error) {
		if (hasStatus(error, 404)) {
			throw notFound();
		}
		throw error;
	}

	if (payload.kind === "redirect") {
		throw redirect({
			to: redirectTo,
			params: { slug: payload.newSlug },
			replace: true,
			code: 301,
			headers: { "Cache-Control": PUBLIC_EVENT_REDIRECT_CACHE_CONTROL },
		});
	}

	if (setResponseHeaders) {
		await setResponseHeaders(
			new Headers({
				"Cache-Control": PUBLIC_EVENT_CACHE_CONTROL,
			}),
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
