import type {
	EventPublicCard,
	OffsetPaginationMeta,
} from "@repo/shared/schemas";
import { PublicEventCard } from "./public-event-card";

export interface PublicEventsListProps {
	events: EventPublicCard[];
	meta?: OffsetPaginationMeta;
}

export function PublicEventsList({ events }: PublicEventsListProps) {
	if (events.length === 0) {
		return (
			<section className="space-y-6">
				<h2 className="font-display text-xl font-semibold">
					Upcoming Events in Coimbatore
				</h2>
				<div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
					<p className="text-sm text-muted-foreground">
						No upcoming events in Coimbatore yet — check back soon!
					</p>
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-6">
			<h2 className="font-display text-xl font-semibold">
				Upcoming Events in Coimbatore
			</h2>
			<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
				{events.map((event) => (
					<PublicEventCard key={event.slug} event={event} />
				))}
			</div>
		</section>
	);
}
