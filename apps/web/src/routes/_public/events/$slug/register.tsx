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
import { resolvePublicEventLoader } from "#/features/event-detail/loader";

/**
 * I-2.1.7 — Phase 3 booking-flow placeholder.
 *
 * Phase 3 will replace this route with the real registration form. Until
 * then it serves as a friendly landing for the prominent "Register now"
 * CTA so the link is never broken. The route is `noindex,nofollow`
 * (placeholder content has nothing for crawlers) and ships the same CDN
 * cache headers as the event detail page so the placeholder cannot be
 * cached longer than the live data.
 *
 * The loader resolves the public event via `resolvePublicEventLoader` so
 * that unknown slugs surface as 404s and renamed slugs 301-redirect to
 * the canonical detail page. The placeholder UI does not consume the
 * fetched event today, but the existence check protects the placeholder
 * from acting as a deep-link doormat for arbitrary URLs.
 */
export const Route = createFileRoute("/_public/events/$slug/register")({
	loader: async ({ params, context }) => {
		await resolvePublicEventLoader({
			slug: params.slug,
			queryClient: context.queryClient,
			setResponseHeaders: setPublicEventCacheHeaders,
			redirectTo: "/events/$slug/register",
		});
	},
	head: () => ({
		meta: [
			{ title: "Register — eventKart" },
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
	component: RegisterRouteComponent,
});

function RegisterRouteComponent() {
	const { slug } = Route.useParams();
	return <RegisterPlaceholder slug={slug} />;
}

export interface RegisterPlaceholderProps {
	slug: string;
}

/**
 * Inner content component, exported separately so unit tests can render
 * the placeholder UI without booting the TanStack Router runtime.
 */
export function RegisterPlaceholder({ slug }: RegisterPlaceholderProps) {
	return (
		<div className="bg-background">
			<div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
				<Card>
					<CardHeader>
						<CardTitle>Registration coming soon</CardTitle>
						<CardDescription>
							Booking opens with our launch — check back soon.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							We&rsquo;re putting the finishing touches on the registration
							flow. In the meantime, review the event details and policies, and
							we&rsquo;ll be ready to take your spot shortly.
						</p>
						<Button asChild variant="outline">
							<Link to="/events/$slug" params={{ slug }}>
								Back to event details
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
