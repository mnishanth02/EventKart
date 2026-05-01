import type {
	OrganizerPublicLookupHttpResponse,
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
	OrganizerPublicSlugRedirect,
} from "@repo/shared/schemas";

export type {
	OrganizerPublicLookupHttpResponse,
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
	OrganizerPublicSlugRedirect,
};

/**
 * The HTTP envelope returned by the public organizer lookup endpoint.
 * `serverApiClient` returns the parsed JSON body directly, so this is
 * the exact shape the api.server helper observes.
 */
export type OrganizerPublicLookupApiEnvelope =
	OrganizerPublicLookupHttpResponse;

/**
 * The shape produced by the route loader. Mirrors the event-detail
 * loader contract: returns the resolved profile (slug redirects are
 * surfaced as thrown router redirects, 404s as `notFound()`).
 */
export interface OrganizerDetailLoaderResult {
	profile: OrganizerPublicProfile;
}
