import { Button } from "@repo/ui/components/ui/button";
import type { EventPublicDetail } from "../types";
import { PublicEventPriceFrom } from "./public-event-price-from";

export interface PublicEventStickyMobileCtaProps {
	event: EventPublicDetail;
}

export function PublicEventStickyMobileCta({
	event,
}: PublicEventStickyMobileCtaProps) {
	return (
		<div className="fixed inset-x-0 bottom-16 z-40 border-t bg-background/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl backdrop-blur lg:hidden">
			<div className="mx-auto max-w-7xl space-y-2">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs text-muted-foreground">
						Booking opens with our launch — check back soon.
					</p>
					<PublicEventPriceFrom
						tiers={event.pricingTiers}
						className="text-right text-xs text-muted-foreground"
					/>
				</div>
				<Button asChild size="lg" className="w-full">
					<a href="#register-coming-soon">Registration coming soon</a>
				</Button>
			</div>
		</div>
	);
}
