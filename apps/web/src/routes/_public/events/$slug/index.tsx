import { createFileRoute } from "@tanstack/react-router";
import { setPublicEventCacheHeaders } from "#/features/event-detail/cache-headers";
import { PublicEventPage } from "#/features/event-detail/components/public-event-page";
import {
	buildPublicEventBreadcrumbJsonLd,
	buildPublicEventJsonLd,
	serializeJsonLdForInlineScript,
} from "#/features/event-detail/json-ld";
import { resolvePublicEventLoader } from "#/features/event-detail/loader";
import { buildPublicEventMeta } from "#/features/event-detail/seo";
import type { EventPublicDetail } from "#/features/event-detail/types";
import { publicEnv } from "#/lib/env/public";

export const Route = createFileRoute("/_public/events/$slug/")({
	loader: async ({ params, context }) =>
		resolvePublicEventLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders: setPublicEventCacheHeaders,
		}),
	head: ({ loaderData }) => {
		const event = loaderData as EventPublicDetail;
		const seo = buildPublicEventMeta(event, {
			siteUrl: publicEnv.VITE_SITE_URL,
			siteName: publicEnv.VITE_APP_TITLE,
		});
		const jsonLd = buildPublicEventJsonLd(event, {
			siteUrl: publicEnv.VITE_SITE_URL,
		});
		const breadcrumbJsonLd = buildPublicEventBreadcrumbJsonLd(event, {
			siteUrl: publicEnv.VITE_SITE_URL,
		});
		const scripts: Array<{
			type: "application/ld+json";
			children: string;
		}> = [
			{
				type: "application/ld+json",
				children: serializeJsonLdForInlineScript(jsonLd),
			},
		];
		// Fail-soft (mirrors I-2.4.7 canonical contract): when
		// `VITE_SITE_URL` is unset/invalid, the breadcrumb helper returns
		// `null` and we skip the second JSON-LD entry rather than emit
		// relative URLs (which Schema.org `BreadcrumbList.item` rejects).
		if (breadcrumbJsonLd) {
			scripts.push({
				type: "application/ld+json",
				children: serializeJsonLdForInlineScript(breadcrumbJsonLd),
			});
		}
		return {
			...seo,
			scripts,
		};
	},
	component: EventDetailRouteComponent,
});

function EventDetailRouteComponent() {
	const event = Route.useLoaderData() as EventPublicDetail;
	return <PublicEventPage event={event} />;
}
