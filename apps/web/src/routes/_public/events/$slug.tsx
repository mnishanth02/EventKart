import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { PublicEventPage } from "#/features/event-detail/components/public-event-page";
import { resolvePublicEventLoader } from "#/features/event-detail/loader";
import type { EventPublicDetail } from "#/features/event-detail/types";

export const Route = createFileRoute("/_public/events/$slug")({
	loader: async ({ params, context }) =>
		resolvePublicEventLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders:
				typeof window === "undefined" ? setResponseHeaders : undefined,
		}),
	head: ({ loaderData }) => {
		const event = loaderData as EventPublicDetail;
		return {
			meta: [
				{ title: `${event.title} — eventKart` },
				{
					name: "description",
					content: event.description.slice(0, 160),
				},
			],
		};
	},
	component: EventDetailRouteComponent,
});

function EventDetailRouteComponent() {
	const event = Route.useLoaderData() as EventPublicDetail;
	return <PublicEventPage event={event} />;
}
