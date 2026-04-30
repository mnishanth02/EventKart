import { Button } from "@repo/ui/components/ui/button";
import { Link } from "@tanstack/react-router";
import { getBookingHref, useRegistrationState } from "../registration";
import type { EventPublicDetail } from "../types";
import { PublicEventEarlyBirdCountdown } from "./public-event-early-bird-countdown";
import { getCtaLabels } from "./public-event-register-cta";
import { PublicEventPriceFrom } from "./public-event-price-from";

export interface PublicEventStickyMobileCtaProps {
	event: EventPublicDetail;
}

export function PublicEventStickyMobileCta({
	event,
}: PublicEventStickyMobileCtaProps) {
	const state = useRegistrationState(event);
	const labels = getCtaLabels(state, event);
	const reasonId = "register-cta-mobile-reason";

	return (
		<div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t bg-background/95 p-3 pb-3 shadow-2xl backdrop-blur md:bottom-0 md:pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
			<div className="mx-auto max-w-7xl space-y-2">
				<div className="flex items-center justify-between gap-3">
					<p id={reasonId} className="text-xs text-muted-foreground">
						{labels.subtitle}
					</p>
					{labels.showPrice ? (
						<PublicEventPriceFrom
							tiers={event.pricingTiers}
							className="text-right text-xs text-muted-foreground"
						/>
					) : null}
				</div>
				<PublicEventEarlyBirdCountdown event={event} state={state} />
				{labels.isActive ? (
					<Button asChild size="lg" className="w-full">
						<Link
							to="/events/$slug/register"
							params={{ slug: event.slug }}
							aria-describedby={reasonId}
						>
							{labels.buttonLabel}
						</Link>
					</Button>
				) : (
					<Button
						type="button"
						size="lg"
						className="w-full"
						disabled
						aria-disabled="true"
						aria-describedby={reasonId}
						data-booking-href={getBookingHref(event)}
					>
						{labels.buttonLabel}
					</Button>
				)}
			</div>
		</div>
	);
}
