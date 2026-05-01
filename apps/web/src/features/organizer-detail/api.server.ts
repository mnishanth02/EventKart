import { organizerPublicLookupHttpResponseSchema } from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import type { OrganizerPublicLookupResponse } from "./types";

/**
 * SSR-only fetch for the public organizer profile lookup.
 *
 * Calls `GET /api/v1/organizers/by-slug/:slug` via the internal API
 * client and validates the envelope through
 * `organizerPublicLookupHttpResponseSchema` (defense-in-depth on top of
 * the Fastify response schema). Returns the inner discriminated union
 * (`{ kind: "organizer", data } | { kind: "redirect", newSlug }`) so
 * the loader can branch on it without re-parsing.
 *
 * Errors are intentionally re-thrown unchanged: the route loader maps
 * `ApiClientError` with `status === 404` to a TanStack `notFound()` and
 * everything else to a 500 surface — same convention as the event-detail
 * loader.
 *
 * @param slug Organizer slug as it appears in the URL. Encoded once via
 *   `encodeURIComponent` before being interpolated into the path.
 */
export async function getPublicOrganizerOnServer(
	slug: string,
): Promise<OrganizerPublicLookupResponse> {
	const envelope = await serverApiClient<unknown>(
		`/organizers/by-slug/${encodeURIComponent(slug)}`,
	);
	const parsed = organizerPublicLookupHttpResponseSchema.parse(envelope);
	return parsed.data;
}
