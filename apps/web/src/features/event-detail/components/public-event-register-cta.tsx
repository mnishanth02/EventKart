import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type { EventPublicDetail } from "../types";
import { PublicEventPriceFrom } from "./public-event-price-from";

export interface PublicEventRegisterCtaProps {
	event: EventPublicDetail;
}

export function PublicEventRegisterCta({ event }: PublicEventRegisterCtaProps) {
	return (
		<Card id="register-coming-soon" className="scroll-mt-24 border-primary/30">
			<CardHeader>
				<CardTitle>Ready to race?</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Booking opens with our launch — check back soon.
				</p>
				<PublicEventPriceFrom tiers={event.pricingTiers} />
				<Button asChild size="lg" className="w-full">
					<a href="#register-coming-soon">Registration coming soon</a>
				</Button>
			</CardContent>
		</Card>
	);
}
