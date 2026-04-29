import { createFileRoute } from "@tanstack/react-router";
import { setPublicEventCacheHeaders } from "#/features/event-detail/cache-headers";
import { PublicEventPage } from "#/features/event-detail/components/public-event-page";
import { resolvePublicEventLoader } from "#/features/event-detail/loader";
import { buildPublicEventMeta } from "#/features/event-detail/seo";
import type { EventPublicDetail } from "#/features/event-detail/types";
import { publicEnv } from "#/lib/env/public";

export const Route = createFileRoute("/_public/events/$slug")({
	loader: async ({ params, context }) =>
		resolvePublicEventLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders: setPublicEventCacheHeaders,
		}),
	head: ({ loaderData }) => {
		const event = loaderData as EventPublicDetail;
		return buildPublicEventMeta(event, {
			siteUrl: publicEnv.VITE_SITE_URL,
			siteName: publicEnv.VITE_APP_TITLE,
		});
	},
	component: EventDetailRouteComponent,
});

function EventDetailRouteComponent() {
	const event = Route.useLoaderData() as EventPublicDetail;
	return <PublicEventPage event={ event } />;
}
