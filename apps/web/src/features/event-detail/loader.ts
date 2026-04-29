import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { publicEventQueryOptions } from "./queries";
import type { EventPublicDetail, EventPublicLookupResponse } from "./types";

export interface ResolvePublicEventLoaderArgs {
	slug: string;
	queryClient: QueryClient;
	setResponseHeaders?: (headers: Headers) => void;
}

export async function resolvePublicEventLoader({
	slug,
	queryClient,
	setResponseHeaders,
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
			to: "/events/$slug",
			params: { slug: payload.newSlug },
			replace: true,
			code: 301,
		});
	}

	if (setResponseHeaders) {
		setResponseHeaders(
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
