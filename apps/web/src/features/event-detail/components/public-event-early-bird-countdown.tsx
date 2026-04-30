import { Badge } from "@repo/ui/components/ui/badge";
import { Clock } from "lucide-react";
import { useEarlyBirdCountdown } from "../early-bird";
import type { RegistrationState } from "../registration";
import type { EventPublicDetail } from "../types";

export interface PublicEventEarlyBirdCountdownProps {
	event: EventPublicDetail;
	state: RegistrationState;
	className?: string;
}

/**
 * I-2.1.10 — Early-bird urgency badge rendered inside the public event CTA
 * (sidebar Card + mobile sticky bar). Pure read of the live derived
 * label from {@link useEarlyBirdCountdown}.
 *
 * Hidden when:
 *   - SSR / pre-mount baseline (hook returns `null`).
 *   - No eligible early-bird tier (hook returns `null`).
 *   - Registration state is `closed_window` or `event_ended` — the
 *     countdown is moot when the offer cannot be used (mirrors the
 *     I-2.1.7 D7 price-hint gating).
 *
 * No `aria-live`: both surfaces render in the DOM (sidebar `<aside>` +
 * mobile fixed bar), so a polite live region on each would
 * double-announce. Visible text is sufficient; the absolute deadline
 * timestamp is already announced inside the breakdown card (I-2.1.4).
 */
export function PublicEventEarlyBirdCountdown({
	event,
	state,
	className,
}: PublicEventEarlyBirdCountdownProps) {
	const countdown = useEarlyBirdCountdown(event);
	if (countdown === null) {
		return null;
	}
	if (state === "closed_window" || state === "event_ended") {
		return null;
	}
	return (
		<Badge
			variant="secondary"
			className={className}
			data-testid="early-bird-countdown"
		>
			<Clock aria-hidden="true" />
			<span>Early-bird closes in {countdown.label}</span>
		</Badge>
	);
}
