import type { QueryClient } from "@tanstack/react-query";
import type { EventPublicCard, OffsetPaginationMeta } from "@repo/shared/schemas";
import type { PublicEventsListParams } from "./api.server";
import { publicEventsListQueryOptions } from "./queries";

export interface ResolvePublicEventsListLoaderArgs {
	queryClient: QueryClient;
	setResponseHeaders?: (headers: Headers) => void | Promise<void>;
	params: PublicEventsListParams;
}

export interface PublicEventsListLoaderData {
	events: EventPublicCard[];
	meta: OffsetPaginationMeta;
}

export async function resolvePublicEventsListLoader({
	queryClient,
	setResponseHeaders,
	params,
}: ResolvePublicEventsListLoaderArgs): Promise<PublicEventsListLoaderData> {
	const payload = await queryClient.ensureQueryData(
		publicEventsListQueryOptions(params),
	);

	if (setResponseHeaders) {
		await setResponseHeaders(
			new Headers({
				"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
			}),
		);
	}

	return { events: payload.data, meta: payload.meta };
}
