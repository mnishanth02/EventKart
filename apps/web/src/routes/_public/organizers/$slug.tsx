import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { setPublicEventCacheHeaders } from "#/features/event-detail/cache-headers";

/**
 * I-2.1.x — Module 2.2 organizer-page placeholder.
 *
 * The public event detail page renders organizer business names as links
 * to `/organizers/$slug` (verified-organizer affordance). Module 2.2 will
 * replace this route with the real organizer profile. Until then it
 * serves as a friendly landing so the link from the event page is never
 * broken. The route is `noindex,nofollow` (placeholder content has
 * nothing for crawlers) and ships the same CDN cache headers as the
 * event detail page so the placeholder cannot be cached longer than the
 * live data.
 *
 * No loader-side existence check yet — Module 2.2 will introduce the
 * organizer lookup. Today's only entry point is from a real event page,
 * so deep-link traffic is negligible.
 */
export const Route = createFileRoute("/_public/organizers/$slug")({
	loader: async () => {
		await setPublicEventCacheHeaders(
			new Headers({
				"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
			}),
		);
	},
	head: () => ({
		meta: [
			{ title: "Organizer — eventKart" },
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
	component: OrganizerRouteComponent,
});

function OrganizerRouteComponent() {
	const { slug } = Route.useParams();
	return <OrganizerPlaceholder slug={slug} />;
}

export interface OrganizerPlaceholderProps {
	slug: string;
}

/**
 * Inner content component, exported separately so unit tests can render
 * the placeholder UI without booting the TanStack Router runtime.
 */
export function OrganizerPlaceholder({ slug: _slug }: OrganizerPlaceholderProps) {
	return (
		<div className="bg-background">
			<div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
				<Card>
					<CardHeader>
						<CardTitle>Organizer profile coming soon</CardTitle>
						<CardDescription>
							Organizer pages launch with our next release — check back soon.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							We&rsquo;re putting the finishing touches on organizer profiles.
							In the meantime, browse upcoming events to find more from this
							organizer.
						</p>
						<Button asChild variant="outline">
							<Link to="/">Back to home</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
