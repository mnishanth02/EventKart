import { serverApiClient } from "#/lib/api-client.server";
import type { EventPublicLookupApiEnvelope } from "./types";

export async function getPublicEventOnServer(
	slug: string,
): Promise<EventPublicLookupApiEnvelope> {
	return serverApiClient<EventPublicLookupApiEnvelope>(
		`/events/by-slug/${encodeURIComponent(slug)}`,
	);
}
