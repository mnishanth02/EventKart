import type { EventPublicPricingTier } from "./types";

export type EarlyBirdStatus = "active" | "expired" | "none";

/**
 * Returns true when a tier has a usable early-bird offer at all (regardless
 * of whether the deadline has passed). Single source of truth for whether
 * to render the early-bird column / row in the UI.
 *
 * Mirrors the legacy guard in {@link getEffectivePricePaise} so the badge
 * shown in the breakdown table can never disagree with the "From INRX" CTA:
 * a tier whose `earlyBirdPrice >= basePrice` is treated as "no offer" by
 * both helpers, even if a future deadline is set.
 */
export function hasValidEarlyBirdOffer(
	tier: Pick<
		EventPublicPricingTier,
		"basePrice" | "earlyBirdPrice" | "earlyBirdDeadline"
	>,
): boolean {
	if (tier.earlyBirdPrice === null || tier.earlyBirdDeadline === null) {
		return false;
	}
	if (tier.earlyBirdPrice >= tier.basePrice) {
		return false;
	}
	const deadlineMs = new Date(tier.earlyBirdDeadline).getTime();
	return !Number.isNaN(deadlineMs);
}

export function getEarlyBirdStatus(
	tier: Pick<
		EventPublicPricingTier,
		"basePrice" | "earlyBirdPrice" | "earlyBirdDeadline"
	>,
	now: Date,
): EarlyBirdStatus {
	if (!hasValidEarlyBirdOffer(tier)) {
		return "none";
	}
	const deadlineMs = new Date(tier.earlyBirdDeadline as string).getTime();
	return now.getTime() < deadlineMs ? "active" : "expired";
}

export function getEffectivePricePaise(
	tier: Pick<
		EventPublicPricingTier,
		"basePrice" | "earlyBirdPrice" | "earlyBirdDeadline"
	>,
	now: Date,
): number {
	if (!hasValidEarlyBirdOffer(tier)) {
		return tier.basePrice;
	}
	const deadlineMs = new Date(tier.earlyBirdDeadline as string).getTime();
	if (now.getTime() >= deadlineMs) {
		return tier.basePrice;
	}
	return tier.earlyBirdPrice as number;
}

export interface StartingPrice {
	pricePaise: number;
	isEarlyBird: boolean;
	categorySlug: EventPublicPricingTier["categorySlug"];
}

export function getStartingPrice(
	tiers: ReadonlyArray<EventPublicPricingTier>,
	now: Date,
): StartingPrice | null {
	if (tiers.length === 0) {
		return null;
	}
	let best: StartingPrice | null = null;
	for (const tier of tiers) {
		const pricePaise = getEffectivePricePaise(tier, now);
		const isEarlyBird = pricePaise !== tier.basePrice;
		if (best === null || pricePaise < best.pricePaise) {
			best = { pricePaise, isEarlyBird, categorySlug: tier.categorySlug };
			continue;
		}
		// Tie-break: prefer non-early-bird (less flashy, more stable label).
		if (pricePaise === best.pricePaise && best.isEarlyBird && !isEarlyBird) {
			best = { pricePaise, isEarlyBird, categorySlug: tier.categorySlug };
		}
	}
	return best;
}
