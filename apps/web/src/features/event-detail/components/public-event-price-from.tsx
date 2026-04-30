import { CurrencyINR } from "#/components/design-system";
import type { EventPublicPricingTier } from "@repo/shared/schemas";
import { useNow } from "../hooks";
import { getStartingPrice } from "../pricing";

export interface PublicEventPriceFromProps {
	tiers: ReadonlyArray<EventPublicPricingTier>;
	className?: string;
}

/**
 * Compact "From ₹X" indicator that updates only after client mount.
 *
 * Renders nothing on the server / first hydration to keep CDN-cached HTML
 * truthful (an early-bird discount must never appear in cached HTML if it
 * could already be expired by the time the client receives it).
 */
export function PublicEventPriceFrom({
	tiers,
	className,
}: PublicEventPriceFromProps) {
	const now = useNow();
	if (now === null) {
		return null;
	}
	const starting = getStartingPrice(tiers, now);
	if (starting === null) {
		return null;
	}
	return (
		<span
			data-testid="price-from"
			className={
				className ??
				"inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
			}
		>
			<span>From</span>
			<CurrencyINR value={starting.pricePaise} />
			{starting.isEarlyBird ? <span>(early-bird)</span> : null}
		</span>
	);
}
