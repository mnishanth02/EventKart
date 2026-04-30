import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { publicEventQueryOptions } from "./queries";
import type { EventPublicDetail, EventPublicLookupResponse } from "./types";

export type PublicEventRedirectTarget =
	| "/events/$slug"
	| "/events/$slug/register";

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
		});
	}

	if (setResponseHeaders) {
		await setResponseHeaders(
			new Headers({
				"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
