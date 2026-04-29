import { Separator } from "@repo/ui/components/ui/separator";
import type { EventPublicDetail } from "../types";
import { PublicEventDetailsSection } from "./public-event-details-section";
import { PublicEventHero } from "./public-event-hero";
import { PublicEventLocationCard } from "./public-event-location-card";
import { PublicEventOrganizerCard } from "./public-event-organizer-card";
import { PublicEventPolicyText } from "./public-event-policy-text";
import { PublicEventPricingBreakdown } from "./public-event-pricing-breakdown";
import { PublicEventRegisterCta } from "./public-event-register-cta";
import { PublicEventStickyMobileCta } from "./public-event-sticky-mobile-cta";

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
					<PublicEventPricingBreakdown event={event} />
					<PublicEventPolicyText
						refundPolicy={event.refundPolicy}
						cancellationPolicy={event.cancellationPolicy}
					/>
				</main>
				<aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
					<PublicEventRegisterCta event={event} />
					<Separator />
					<PublicEventLocationCard event={event} />
					<PublicEventOrganizerCard organizer={event.organizer} />
				</aside>
			</div>
			<PublicEventStickyMobileCta event={event} />
		</div>
	);
}
