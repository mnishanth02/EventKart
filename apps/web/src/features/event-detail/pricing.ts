import type { EventPublicPricingTier } from "./types";

export type EarlyBirdStatus = "active" | "expired" | "none";

export function getEarlyBirdStatus(
	tier: Pick<EventPublicPricingTier, "earlyBirdPrice" | "earlyBirdDeadline">,
	now: Date,
): EarlyBirdStatus {
	if (tier.earlyBirdPrice === null || tier.earlyBirdDeadline === null) {
		return "none";
	}
	const deadlineMs = new Date(tier.earlyBirdDeadline).getTime();
	if (Number.isNaN(deadlineMs)) {
		return "none";
	}
	return now.getTime() < deadlineMs ? "active" : "expired";
}

export function getEffectivePricePaise(
	tier: Pick<
		EventPublicPricingTier,
		"basePrice" | "earlyBirdPrice" | "earlyBirdDeadline"
	>,
	now: Date,
): number {
	if (tier.earlyBirdPrice === null || tier.earlyBirdDeadline === null) {
		return tier.basePrice;
	}
	if (tier.earlyBirdPrice >= tier.basePrice) {
		return tier.basePrice;
	}
	const deadlineMs = new Date(tier.earlyBirdDeadline).getTime();
	if (Number.isNaN(deadlineMs) || now.getTime() >= deadlineMs) {
		return tier.basePrice;
	}
	return tier.earlyBirdPrice;
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
