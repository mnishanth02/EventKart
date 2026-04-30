import { describe, expect, it } from "vitest";
import { eventPublicPricingTierSchema } from "@repo/shared/schemas";
import {
	formatEarlyBirdCountdown,
	getNextActiveEarlyBirdCutoff,
	getNextCountdownDelayMs,
} from "./early-bird";
import type { EarlyBirdEventFields } from "./early-bird";
import type { EventPublicPricingTier } from "./types";

const tier = (
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

const baseEvent: EarlyBirdEventFields = {
	registrationOpensAt: "2026-06-01T00:00:00.000Z",
	registrationClosesAt: "2026-08-14T18:00:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
};

describe("getNextActiveEarlyBirdCutoff", () => {
	const now = new Date("2026-07-01T00:00:00.000Z");

	it("returns null when there are no tiers", () => {
		expect(getNextActiveEarlyBirdCutoff([], baseEvent, now)).toBeNull();
	});

	it("returns null when no tier has a valid early-bird offer", () => {
		const tiers = [
			tier({ categorySlug: "5k" }),
			tier({ categorySlug: "10k", basePrice: 129_900 }),
		];
		expect(getNextActiveEarlyBirdCutoff(tiers, baseEvent, now)).toBeNull();
	});

	it("filters tiers with earlyBirdPrice >= basePrice (legacy guard parity)", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 100_000,
				earlyBirdPrice: 100_000,
				earlyBirdDeadline: "2026-07-15T00:00:00.000Z",
			}),
		];
		expect(getNextActiveEarlyBirdCutoff(tiers, baseEvent, now)).toBeNull();
	});

	it("returns the in-future deadline when it is the binding cutoff", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getNextActiveEarlyBirdCutoff(tiers, baseEvent, now);
		expect(result).toEqual({
			cutoffMs: Date.parse("2026-07-15T12:30:00.000Z"),
			categorySlug: "5k",
		});
	});

	it("uses registrationClosesAt as the cutoff when earlier than the raw deadline", () => {
		// Critical-1 from plan review: countdown must use the effective cutoff,
		// not the raw deadline, when registrationClosesAt is earlier.
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-09-01T00:00:00.000Z",
			}),
		];
		const result = getNextActiveEarlyBirdCutoff(tiers, baseEvent, now);
		expect(result?.cutoffMs).toBe(
			Date.parse(baseEvent.registrationClosesAt ?? ""),
		);
	});

	it("uses endAt as the cutoff when earlier than both deadline and close", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-09-01T00:00:00.000Z",
			}),
		];
		const event: EarlyBirdEventFields = {
			registrationOpensAt: null,
			registrationClosesAt: null,
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const result = getNextActiveEarlyBirdCutoff(tiers, event, now);
		expect(result?.cutoffMs).toBe(Date.parse(event.endAt));
	});

	it("filters tiers whose effective cutoff is at or before now", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-06-15T00:00:00.000Z",
			}),
		];
		expect(getNextActiveEarlyBirdCutoff(tiers, baseEvent, now)).toBeNull();
	});

	it("filters tiers where registrationOpensAt >= effectiveCutoff (offer unreachable)", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-05-15T00:00:00.000Z",
			}),
		];
		const event: EarlyBirdEventFields = {
			registrationOpensAt: "2026-06-01T00:00:00.000Z",
			registrationClosesAt: "2026-08-14T18:00:00.000Z",
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const earlyNow = new Date("2026-04-01T00:00:00.000Z");
		expect(getNextActiveEarlyBirdCutoff(tiers, event, earlyNow)).toBeNull();
	});

	it("picks the soonest effective cutoff across multiple eligible tiers", () => {
		const tiers = [
			tier({
				categorySlug: "10k",
				basePrice: 129_900,
				earlyBirdPrice: 99_900,
				earlyBirdDeadline: "2026-07-30T00:00:00.000Z",
			}),
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getNextActiveEarlyBirdCutoff(tiers, baseEvent, now);
		expect(result).toEqual({
			cutoffMs: Date.parse("2026-07-15T12:30:00.000Z"),
			categorySlug: "5k",
		});
	});

	it("preserves insertion order on identical cutoffs", () => {
		const tiers = [
			tier({
				categorySlug: "10k",
				basePrice: 129_900,
				earlyBirdPrice: 99_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getNextActiveEarlyBirdCutoff(tiers, baseEvent, now);
		expect(result?.categorySlug).toBe("10k");
	});

	it("rolls over to the next tier when the soonest cutoff has passed", () => {
		const tiers = [
			tier({
				categorySlug: "5k",
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-06-15T00:00:00.000Z",
			}),
			tier({
				categorySlug: "10k",
				basePrice: 129_900,
				earlyBirdPrice: 99_900,
				earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			}),
		];
		const result = getNextActiveEarlyBirdCutoff(tiers, baseEvent, now);
		expect(result?.categorySlug).toBe("10k");
	});
});

describe("formatEarlyBirdCountdown", () => {
	const now = new Date("2026-07-01T00:00:00.000Z").getTime();

	it("returns null when the cutoff has passed", () => {
		expect(formatEarlyBirdCountdown(now, now)).toBeNull();
		expect(formatEarlyBirdCountdown(now - 1000, now)).toBeNull();
	});

	it("returns '<1m' when less than one minute remains", () => {
		expect(formatEarlyBirdCountdown(now + 1000, now)).toBe("<1m");
		expect(formatEarlyBirdCountdown(now + 59_999, now)).toBe("<1m");
	});

	it("returns 'Xm' between 1m and 1h", () => {
		expect(formatEarlyBirdCountdown(now + 60_000, now)).toBe("1m");
		expect(formatEarlyBirdCountdown(now + 45 * 60_000, now)).toBe("45m");
		expect(formatEarlyBirdCountdown(now + 59 * 60_000 + 999, now)).toBe(
			"59m",
		);
	});

	it("returns 'Xh Ym' between 1h and 24h (always emits both units)", () => {
		expect(formatEarlyBirdCountdown(now + 60 * 60_000, now)).toBe("1h 0m");
		expect(
			formatEarlyBirdCountdown(now + 2 * 60 * 60_000 + 30 * 60_000, now),
		).toBe("2h 30m");
		expect(
			formatEarlyBirdCountdown(now + 23 * 60 * 60_000 + 59 * 60_000, now),
		).toBe("23h 59m");
	});

	it("returns 'Xd Yh' at or above 24h (always emits both units)", () => {
		expect(formatEarlyBirdCountdown(now + 24 * 60 * 60_000, now)).toBe(
			"1d 0h",
		);
		expect(
			formatEarlyBirdCountdown(
				now + 2 * 24 * 60 * 60_000 + 3 * 60 * 60_000,
				now,
			),
		).toBe("2d 3h");
		expect(
			formatEarlyBirdCountdown(
				now + 30 * 24 * 60 * 60_000 + 11 * 60 * 60_000,
				now,
			),
		).toBe("30d 11h");
	});
});

describe("getNextCountdownDelayMs", () => {
	const now = new Date("2026-07-01T00:00:00.000Z").getTime();

	it("returns null when the cutoff has passed", () => {
		expect(getNextCountdownDelayMs(now, now)).toBeNull();
		expect(getNextCountdownDelayMs(now - 1000, now)).toBeNull();
	});

	it("returns 1 ms when remaining time is an exact multiple of 60_000", () => {
		expect(getNextCountdownDelayMs(now + 60_000, now)).toBe(1);
		expect(getNextCountdownDelayMs(now + 5 * 60_000, now)).toBe(1);
		expect(getNextCountdownDelayMs(now + 24 * 60 * 60_000, now)).toBe(1);
	});

	it("schedules at the next minute-floor transition (no global +1ms drift)", () => {
		// Critical-2 from plan review: a global per-minute +1ms adder would
		// undercount the displayed minute by one. Verify the residue math.
		// 2h 30s remaining → next floor change in 30s + 1 = 30_001ms.
		const remaining = 2 * 60 * 60_000 + 30_000;
		expect(getNextCountdownDelayMs(now + remaining, now)).toBe(30_001);
	});

	it("never exceeds 60_001 ms", () => {
		// Bounded by construction since residue < 60_000.
		for (const remaining of [
			60_500, 90_000, 3_600_500, 24 * 60 * 60_000 + 12_345,
		]) {
			const delay = getNextCountdownDelayMs(now + remaining, now);
			expect(delay).not.toBeNull();
			expect(delay).toBeLessThanOrEqual(60_001);
			expect(delay).toBeGreaterThanOrEqual(1);
		}
	});

	it("schedules to fire shortly past the cutoff in the sub-minute bucket", () => {
		// 45s remaining (sub-minute bucket): currentFloor = 0.
		// delay = 45000 - 0 + 1 = 45001ms — fires 1ms past the cutoff so
		// the next tick re-derives and returns null (badge unmounts).
		expect(getNextCountdownDelayMs(now + 45_000, now)).toBe(45_001);
	});
});
