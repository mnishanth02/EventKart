import { serverApiClient } from "#/lib/api-client.server";
import type { EventPublicCard, OffsetPaginationMeta } from "@repo/shared/schemas";

export interface PublicEventsListParams {
	page: number;
	limit: number;
	sort: "startAtAsc";
}

export interface PublicEventsListApiEnvelope {
	success: true;
	data: EventPublicCard[];
	meta: OffsetPaginationMeta;
}

export async function getPublicEventsListOnServer({
	page,
	limit,
	sort,
}: PublicEventsListParams): Promise<PublicEventsListApiEnvelope> {
	const search = new URLSearchParams({
		page: String(page),
		limit: String(limit),
		sort,
	});
	return serverApiClient<PublicEventsListApiEnvelope>(
		`/events/public?${search.toString()}`,
	);
}
