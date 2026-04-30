import { createFileRoute } from "@tanstack/react-router";
import { setOrganizerDetailCacheHeaders } from "#/features/organizer-detail/cache-headers";
import { PublicOrganizerProfile } from "#/features/organizer-detail/components/PublicOrganizerProfile";
import { resolvePublicOrganizerLoader } from "#/features/organizer-detail/loader";
import { buildOrganizerDetailHead } from "#/features/organizer-detail/seo";
import type { OrganizerPublicProfile } from "#/features/organizer-detail/types";
import { publicEnv } from "#/lib/env/public";

/**
 * Public organizer profile route (I-2.3.1).
 *
 * SSR + CDN-cached so verified-organizer affordances on `/events/:slug`
 * land on a search-friendly page. Slug-rename redirects and 404s are
 * resolved by `resolvePublicOrganizerLoader`; cache headers and `head()`
 * meta come from the colocated feature module.
 *
 * Slug validation lives in the `getPublicOrganizer` createServerFn
 * (input validator on `organizerSlugSchema`) so SSR navigations to a
 * malformed slug fail the loader fetch before any UI mounts.
 *
 * Unverified organizers are still publicly addressable (so the link
 * from `/events/:slug` keeps working) but are tagged
 * `noindex,nofollow` via `buildOrganizerDetailHead`.
 */
export const Route = createFileRoute("/_public/organizers/$slug")({
	loader: async ({ params, context }) =>
		resolvePublicOrganizerLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders: setOrganizerDetailCacheHeaders,
		}),
	head: ({ loaderData }) => {
		const profile = loaderData as OrganizerPublicProfile | undefined;
		if (!profile) return {};
		return buildOrganizerDetailHead(profile, {
			siteUrl: publicEnv.VITE_SITE_URL,
		});
	},
	component: OrganizerDetailRouteComponent,
});

function OrganizerDetailRouteComponent() {
	const profile = Route.useLoaderData() as OrganizerPublicProfile;
	return <PublicOrganizerProfile profile={profile} />;
}
