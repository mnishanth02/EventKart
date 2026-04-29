import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import type { EventPublicDetail } from "../types";
import { PublicEventCategoriesTable } from "./public-event-categories-table";
import { PublicEventDetailsSection } from "./public-event-details-section";
import { PublicEventHero } from "./public-event-hero";
import { PublicEventLocationCard } from "./public-event-location-card";
import { PublicEventOrganizerCard } from "./public-event-organizer-card";
import { PublicEventPolicySection } from "./public-event-policy-section";
import { PublicEventPricingTable } from "./public-event-pricing-table";
import { PublicEventRegisterCta } from "./public-event-register-cta";

export interface PublicEventPageProps {
	event: EventPublicDetail;
}

export function PublicEventPage({ event }: PublicEventPageProps) {
	return (
		<div className="bg-background">
			<div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-6 pb-44 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 lg:pb-16">
				<main className="min-w-0 space-y-8">
					<PublicEventHero event={event} />
					<PublicEventDetailsSection event={event} />
					<div className="grid gap-6 xl:grid-cols-2">
						<PublicEventCategoriesTable categories={event.categories} />
						<PublicEventPricingTable event={event} />
					</div>
					<PublicEventPolicySection
						refundPolicy={event.refundPolicy}
						cancellationPolicy={event.cancellationPolicy}
						organizer={event.organizer}
					/>
				</main>
				<aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
					<PublicEventRegisterCta />
					<Separator />
					<PublicEventLocationCard event={event} />
					<PublicEventOrganizerCard organizer={event.organizer} />
				</aside>
			</div>
			<div className="fixed inset-x-0 bottom-16 z-40 border-t bg-background/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl backdrop-blur lg:hidden">
				<div className="mx-auto max-w-7xl">
					<p className="mb-2 text-center text-xs text-muted-foreground">
						Booking opens with our launch — check back soon.
					</p>
					<Button asChild size="lg" className="w-full">
						<a href="#register-coming-soon">Registration coming soon</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
