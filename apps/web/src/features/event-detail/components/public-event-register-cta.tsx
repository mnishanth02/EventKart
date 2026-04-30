import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
	formatRegistrationDate,
	getBookingHref,
	type RegistrationState,
	useRegistrationState,
} from "../registration";
import type { EventPublicDetail } from "../types";
import { PublicEventEarlyBirdCountdown } from "./public-event-early-bird-countdown";
import { PublicEventPriceFrom } from "./public-event-price-from";

export interface PublicEventRegisterCtaProps {
	event: EventPublicDetail;
}

export interface CtaLabels {
	/** The Card / section title. */
	title: string;
	/** Subtitle paragraph (always visible; also referenced by `aria-describedby`). */
	subtitle: string;
	/** Visible label on the button. */
	buttonLabel: string;
	/** True when the button should render as a typed `<Link>` to the booking flow. */
	isActive: boolean;
	/** True when the "From ₹X" price hint may be shown alongside the CTA. */
	showPrice: boolean;
}

/**
 * Single source of truth for the user-visible CTA copy across the desktop
 * sidebar Card and the fixed mobile bottom bar. Centralised so both
 * surfaces always agree (including new states added in the future).
 */
export function getCtaLabels(
	state: RegistrationState,
	event: EventPublicDetail,
): CtaLabels {
	switch (state) {
		case "open":
			return {
				title: "Ready to race?",
				subtitle:
					"Secure your spot now — registration is open for this event.",
				buttonLabel: "Register now",
				isActive: true,
				showPrice: true,
			};
		case "not_yet_open": {
			const opensAt = event.registrationOpensAt;
			const formatted = opensAt
				? formatRegistrationDate(opensAt, event.timezone)
				: null;
			return {
				title: "Registration opening soon",
				subtitle: formatted
					? `Registration opens ${formatted}.`
					: "Registration opens soon — check back closer to event day.",
				buttonLabel: formatted
					? `Registration opens ${formatted}`
					: "Registration opens soon",
				isActive: false,
				showPrice: true,
			};
		}
		case "closed_window":
			return {
				title: "Registration closed",
				subtitle:
					"Registration for this event has closed. Follow the organizer for future events.",
				buttonLabel: "Registration closed",
				isActive: false,
				showPrice: false,
			};
		case "event_ended":
			return {
				title: "This event has ended",
				subtitle:
					"This event is over. Browse upcoming events from this organizer.",
				buttonLabel: "Event has ended",
				isActive: false,
				showPrice: false,
			};
		case "unknown":
			return {
				// SSR / pre-mount neutral baseline. Never asserts availability so
				// CDN-cached HTML can never lie about the registration window.
				title: "Ready to race?",
				subtitle: "Booking opens with our launch — check back soon.",
				buttonLabel: "View registration",
				isActive: true,
				showPrice: false,
			};
	}
}

export function PublicEventRegisterCta({ event }: PublicEventRegisterCtaProps) {
	const state = useRegistrationState(event);
	const labels = getCtaLabels(state, event);
	const reasonId = "register-cta-reason";

	return (
		<Card id="register-coming-soon" className="scroll-mt-24 border-primary/30">
			<CardHeader>
				<CardTitle>{labels.title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p id={reasonId} className="text-sm text-muted-foreground">
					{labels.subtitle}
				</p>
				<PublicEventEarlyBirdCountdown event={event} state={state} />
				{labels.showPrice ? (
					<PublicEventPriceFrom tiers={event.pricingTiers} />
				) : null}
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
			</CardContent>
			<CardFooter>
				<a
					href="#policies"
					className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
				>
					Review refund &amp; cancellation policies
				</a>
			</CardFooter>
		</Card>
	);
}
