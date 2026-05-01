import { createFileRoute } from "@tanstack/react-router";
import { setOrganizerDetailCacheHeaders } from "#/features/organizer-detail/cache-headers";
import { PublicOrganizerProfile } from "#/features/organizer-detail/components/PublicOrganizerProfile";
import { PastEventsSection } from "#/features/organizer-detail/components/past-events-section";
import { UpcomingEventsSection } from "#/features/organizer-detail/components/upcoming-events-section";
import {
	type PublicOrganizerLoaderData,
	resolvePublicOrganizerLoader,
} from "#/features/organizer-detail/loader";
import { buildOrganizerDetailHead } from "#/features/organizer-detail/seo";

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
type OrganizerDetailRouteData = PublicOrganizerLoaderData & {
	siteUrl?: string | undefined;
};

export const Route = createFileRoute("/_public/organizers/$slug")({
	ssr: true,
	loader: async ({ params, context }) => {
		const data = await resolvePublicOrganizerLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders: setOrganizerDetailCacheHeaders,
		});
		const { publicEnv } = await import("#/lib/env/public");
		return {
			...data,
			siteUrl: publicEnv.VITE_SITE_URL,
		} satisfies OrganizerDetailRouteData;
	},
	head: ({ loaderData }) => {
		const data = loaderData as OrganizerDetailRouteData | undefined;
		if (!data) return {};
		return buildOrganizerDetailHead(data.profile, { siteUrl: data.siteUrl });
	},
	component: OrganizerDetailRouteComponent,
});

function OrganizerDetailRouteComponent() {
	const { profile, upcomingEvents, pastEvents } =
		Route.useLoaderData() as PublicOrganizerLoaderData;
	return (
		<OrganizerDetailView
			profile={profile}
			upcomingEvents={upcomingEvents}
			pastEvents={pastEvents}
		/>
	);
}

/**
 * Pure view for the organizer detail route. Split out from the route
 * `component` so it can be unit-tested without mocking the router's
 * loader-data hooks. Stacks the profile card, upcoming events section,
 * and past events section vertically inside the shared profile
 * container, with `space-y-12` matching event-detail spacing rhythm.
 */
export function OrganizerDetailView({
	profile,
	upcomingEvents,
	pastEvents,
}: PublicOrganizerLoaderData) {
	return (
		<>
			<PublicOrganizerProfile profile={profile} />
			<div className="mx-auto w-full max-w-3xl space-y-12 px-4 pb-12 sm:px-6 lg:px-8">
				<UpcomingEventsSection
					events={upcomingEvents}
					organizerName={profile.businessName}
				/>
				<PastEventsSection
					events={pastEvents}
					organizerName={profile.businessName}
				/>
			</div>
		</>
	);
}
