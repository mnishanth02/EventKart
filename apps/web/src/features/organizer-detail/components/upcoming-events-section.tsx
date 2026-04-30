import type { EventPublicCard } from "@repo/shared/schemas";
import { PublicEventCard } from "#/features/events-discovery/components/public-event-card";

export interface UpcomingEventsSectionProps {
	events: EventPublicCard[];
	organizerName: string;
}

/**
 * Upcoming events list rendered on the public organizer profile
 * (I-2.3.2).
 *
 * Reuses `<PublicEventCard>` from events-discovery so a single source
 * of truth governs card layout, status badges, and pricing across the
 * homepage and the organizer profile. The page is already scoped to
 * one organizer, so the heading omits "from <name>" — that scope is
 * implied by the route.
 *
 * The grid is intentionally narrower (1/2 cols) than the homepage
 * (1/2/3 cols) because the profile page constrains content to
 * `max-w-3xl`; a third column would force cards too narrow at desktop.
 *
 * The empty state mirrors the dashed-border placeholder used by
 * `<PublicEventsList>` so empty surfaces feel consistent across the
 * public discovery experience.
 */
export function UpcomingEventsSection({
	events,
	organizerName,
}: UpcomingEventsSectionProps) {
	return (
		<section id="upcoming-events" className="space-y-6">
			<h2 className="font-display text-xl font-semibold">Upcoming events</h2>
			{events.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
					<p className="text-sm text-muted-foreground">
						{organizerName} has no upcoming events listed yet.
					</p>
				</div>
			) : (
				<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
					{events.map((event) => (
						<PublicEventCard key={event.slug} event={event} />
					))}
				</div>
			)}
		</section>
	);
}
