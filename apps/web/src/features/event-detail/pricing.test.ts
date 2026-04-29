import { describe, expect, it } from "vitest";
import { eventPublicPricingTierSchema } from "@repo/shared/schemas";
import {
	getEarlyBirdStatus,
	getEffectivePricePaise,
	getStartingPrice,
} from "./pricing";
import type { EventPublicPricingTier } from "./types";

const baseTier = (
	overrides: Partial<{
		categorySlug: string;
		basePrice: number;
		earlyBirdPrice: number | null;
		earlyBirdDeadline: string | null;
	}> = {},
): EventPublicPricingTier =>
	eventPublicPricingTierSchema.parse({
		categorySlug: "5k",
		basePrice: 100_000,
		earlyBirdPrice: null,
		earlyBirdDeadline: null,
		currency: "INR",
		...overrides,
	});

describe("getEarlyBirdStatus", () => {
	it("returns 'none' when there is no early-bird price", () => {
		expect(getEarlyBirdStatus(baseTier(), new Date("2026-01-01T00:00:00Z"))).toBe(
			"none",
		);
	});

	it("returns 'none' when deadline is missing even if a price is set", () => {
		const tier = baseTier({ earlyBirdPrice: 80_000, earlyBirdDeadline: null });
		expect(getEarlyBirdStatus(tier, new Date("2026-01-01T00:00:00Z"))).toBe(
			"none",
		);
	});

	it("returns 'active' before the deadline", () => {
		const tier = baseTier({
			earlyBirdPrice: 80_000,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
		});
		expect(getEarlyBirdStatus(tier, new Date("2026-07-15T12:29:59.999Z"))).toBe(
			"active",
		);
	});

	it("returns 'expired' exactly at the deadline (right-open interval)", () => {
		const tier = baseTier({
			earlyBirdPrice: 80_000,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
		});
		expect(getEarlyBirdStatus(tier, new Date("2026-07-15T12:30:00.000Z"))).toBe(
			"expired",
		);
	});

	it("returns 'expired' after the deadline", () => {
		const tier = baseTier({
			earlyBirdPrice: 80_000,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
		});
		expect(getEarlyBirdStatus(tier, new Date("2026-08-01T00:00:00Z"))).toBe(
			"expired",
		);
	});
});

describe("getEffectivePricePaise", () => {
	it("returns base price when no early-bird is configured", () => {
		expect(
			getEffectivePricePaise(baseTier(), new Date("2026-01-01T00:00:00Z")),
		).toBe(100_000);
	});

	it("returns early-bird price during the active window", () => {
		const tier = baseTier({
			earlyBirdPrice: 80_000,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
		});
		expect(
			getEffectivePricePaise(tier, new Date("2026-07-01T00:00:00Z")),
		).toBe(80_000);
	});

	it("returns base price after the deadline", () => {
		const tier = baseTier({
			earlyBirdPrice: 80_000,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
		});
		expect(
			getEffectivePricePaise(tier, new Date("2026-07-16T00:00:00Z")),
		).toBe(100_000);
	});

	it("falls back to base when early-bird >= base (legacy data guard)", () => {
		const tier = baseTier({
			basePrice: 100_000,
			earlyBirdPrice: 100_000,
			earlyBirdDeadline: "2099-12-31T00:00:00.000Z",
		});
		expect(
			getEffectivePricePaise(tier, new Date("2026-01-01T00:00:00Z")),
		).toBe(100_000);
	});
});

describe("getStartingPrice", () => {
	it("returns null when there are no tiers", () => {
		expect(getStartingPrice([], new Date("2026-01-01T00:00:00Z"))).toBeNull();
	});

	it("selects the cheapest effective price across mixed tiers", () => {
		const tiers = [
			baseTier({ categorySlug: "10k", basePrice: 129_900 }),
			baseTier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getStartingPrice(tiers, new Date("2026-07-01T00:00:00Z"));
		expect(result).toEqual({
			pricePaise: 59_900,
			isEarlyBird: true,
			categorySlug: "5k",
		});
	});

	it("ignores expired early-bird prices when ranking", () => {
		const tiers = [
			baseTier({ categorySlug: "10k", basePrice: 129_900 }),
			baseTier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getStartingPrice(tiers, new Date("2026-08-01T00:00:00Z"));
		expect(result).toEqual({
			pricePaise: 79_900,
			isEarlyBird: false,
			categorySlug: "5k",
		});
	});

	it("prefers a non-early-bird tier on a tie", () => {
		const tiers = [
			baseTier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
			baseTier({ categorySlug: "kids", basePrice: 59_900 }),
		];
		const result = getStartingPrice(tiers, new Date("2026-07-01T00:00:00Z"));
		expect(result).toEqual({
			pricePaise: 59_900,
			isEarlyBird: false,
			categorySlug: "kids",
		});
	});

	it("keeps the first cheapest non-EB tier when multiple non-EB tiers tie", () => {
		const tiers = [
			baseTier({ categorySlug: "kids", basePrice: 59_900 }),
			baseTier({ categorySlug: "students", basePrice: 59_900 }),
		];
		const result = getStartingPrice(tiers, new Date("2026-07-01T00:00:00Z"));
		expect(result).toEqual({
			pricePaise: 59_900,
			isEarlyBird: false,
			categorySlug: "kids",
		});
	});
});
