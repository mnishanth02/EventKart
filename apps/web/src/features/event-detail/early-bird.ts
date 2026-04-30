import { useEffect, useMemo, useState } from "react";
import { hasValidEarlyBirdOffer } from "./pricing";
import type { EventPublicDetail, EventPublicPricingTier } from "./types";

/**
 * I-2.1.10 — Early-bird countdown.
 *
 * The badge counts down to the earliest moment the **soonest** early-bird
 * offer becomes unusable, which is `min(earlyBirdDeadline,
 * registrationClosesAt, endAt)` — not the raw `earlyBirdDeadline` (which
 * may run past close/end on a misconfigured event).
 *
 * SSR-safe: {@link useEarlyBirdCountdown} returns `null` until mount so the
 * CDN-cached HTML never advertises a stale countdown.
 */

/** Fields the helpers read from the event payload. */
export interface EarlyBirdEventFields {
	registrationOpensAt: string | null;
	registrationClosesAt: string | null;
	endAt: string;
}

export interface ActiveEarlyBirdCutoff {
	/** Effective cutoff in ms epoch. */
	cutoffMs: number;
	/** Category slug of the source tier (deterministic tie-break: insertion order). */
	categorySlug: EventPublicPricingTier["categorySlug"];
}

function parseTimestampMs(value: string | null): number | null {
	if (value === null) {
		return null;
	}
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Returns the soonest in-future **effective** cutoff among eligible tiers,
 * or `null` when no tier qualifies.
 *
 * Eligibility:
 *   - {@link hasValidEarlyBirdOffer} returns `true` (legacy guard parity
 *     with I-2.1.4 — `earlyBirdPrice >= basePrice` is treated as no offer).
 *   - `effectiveCutoffMs > now`.
 *   - `registrationOpensAt === null || parse(registrationOpensAt) <
 *     effectiveCutoffMs` (offer must be reachable from inside the
 *     registration window — a tier whose offer expires before registration
 *     even opens is filtered out so the badge never advertises an
 *     unusable offer).
 *
 * On exact tie, the first tier in `tiers` wins (deterministic, matches
 * insertion order).
 */
export function getNextActiveEarlyBirdCutoff(
	tiers: ReadonlyArray<EventPublicPricingTier>,
	event: EarlyBirdEventFields,
	now: Date,
): ActiveEarlyBirdCutoff | null {
	if (tiers.length === 0) {
		return null;
	}
	const nowMs = now.getTime();
	const opensMs = parseTimestampMs(event.registrationOpensAt);
	const closesMs = parseTimestampMs(event.registrationClosesAt);
	const endMs = parseTimestampMs(event.endAt);

	let best: ActiveEarlyBirdCutoff | null = null;
	for (const tier of tiers) {
		if (!hasValidEarlyBirdOffer(tier)) {
			continue;
		}
		const deadlineMs = parseTimestampMs(tier.earlyBirdDeadline);
		if (deadlineMs === null) {
			// `hasValidEarlyBirdOffer` already rejects NaN deadlines, but the
			// type narrowing here is defence in depth.
			continue;
		}
		const candidates: number[] = [deadlineMs];
		if (closesMs !== null) {
			candidates.push(closesMs);
		}
		if (endMs !== null) {
			candidates.push(endMs);
		}
		const cutoffMs = Math.min(...candidates);
		if (cutoffMs <= nowMs) {
			continue;
		}
		if (opensMs !== null && opensMs >= cutoffMs) {
			// Offer is unreachable — registration opens at or after the cutoff.
			continue;
		}
		if (best === null || cutoffMs < best.cutoffMs) {
			best = { cutoffMs, categorySlug: tier.categorySlug };
		}
	}
	return best;
}

/**
 * Formats the remaining time until `cutoffMs` for the early-bird badge.
 *
 * Buckets:
 *   - `≥ 24h`: `"Xd Yh"` (always emit both units; "2d 0h" is acceptable).
 *   - `≥ 1h, < 24h`: `"Xh Ym"` (always both).
 *   - `≥ 1m, < 1h`: `"Xm"`.
 *   - `< 1m, > 0`: `"<1m"`.
 *   - `<= 0`: `null` (component hides; the chained scheduler re-derives the
 *     next eligible tier on the next tick).
 */
export function formatEarlyBirdCountdown(
	cutoffMs: number,
	nowMs: number,
): string | null {
	const remainingMs = cutoffMs - nowMs;
	if (remainingMs <= 0) {
		return null;
	}
	const totalMinutes = Math.floor(remainingMs / 60_000);
	if (totalMinutes < 1) {
		return "<1m";
	}
	if (totalMinutes < 60) {
		return `${totalMinutes}m`;
	}
	const totalHours = Math.floor(totalMinutes / 60);
	if (totalHours < 24) {
		const minutes = totalMinutes - totalHours * 60;
		return `${totalHours}h ${minutes}m`;
	}
	const days = Math.floor(totalHours / 24);
	const hours = totalHours - days * 24;
	return `${days}d ${hours}h`;
}

/**
 * Returns the next setTimeout delay (ms) so the chained scheduler fires
 * exactly when the displayed minute floor changes.
 *
 * `delay = msUntilCutoff - currentFloorMin * 60_000 + 1`. The `+1ms` lands
 * one millisecond past the bucket boundary so the recomputed `floor`
 * registers as the lower bucket. By construction the residue is bounded
 * by `60_000`, so `delay <= 60_001 ms`. Floored at `1` for defence in
 * depth (the formula naturally yields `1` when `msUntilCutoff` is an exact
 * multiple of `60_000`).
 *
 * Returns `null` when the cutoff has already passed (caller should stop
 * scheduling).
 */
export function getNextCountdownDelayMs(
	cutoffMs: number,
	nowMs: number,
): number | null {
	const remainingMs = cutoffMs - nowMs;
	if (remainingMs <= 0) {
		return null;
	}
	const currentFloorMin = Math.floor(remainingMs / 60_000);
	const delay = remainingMs - currentFloorMin * 60_000 + 1;
	return Math.max(1, delay);
}

export interface EarlyBirdCountdownLabel {
	/** Compact visible label, e.g. `"2d 3h"`. */
	label: string;
	/** Source tier slug — exposed for tests / future analytics. */
	categorySlug: EventPublicPricingTier["categorySlug"];
}

/**
 * SSR-safe early-bird countdown hook.
 *
 * Returns `null` on SSR + first render (cached HTML never advertises a
 * stale countdown). After mount, returns `{ label, categorySlug }` for the
 * soonest eligible tier and schedules a single chained `setTimeout` at
 * each minute-floor transition. When the cutoff passes, the helper
 * automatically rolls to the next eligible tier (if any), or returns
 * `null` (the badge unmounts).
 */
export function useEarlyBirdCountdown(
	event: Pick<
		EventPublicDetail,
		"pricingTiers" | "registrationOpensAt" | "registrationClosesAt" | "endAt"
	>,
): EarlyBirdCountdownLabel | null {
	const [now, setNow] = useState<Date | null>(null);
	const { pricingTiers, registrationOpensAt, registrationClosesAt, endAt } =
		event;

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const fields: EarlyBirdEventFields = {
			registrationOpensAt,
			registrationClosesAt,
			endAt,
		};

		function tick() {
			const current = new Date();
			setNow(current);
			const next = getNextActiveEarlyBirdCutoff(pricingTiers, fields, current);
			if (next === null) {
				return;
			}
			const delay = getNextCountdownDelayMs(next.cutoffMs, current.getTime());
			if (delay === null) {
				return;
			}
			timeoutId = setTimeout(tick, delay);
		}

		tick();
		return () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	}, [pricingTiers, registrationOpensAt, registrationClosesAt, endAt]);

	return useMemo(() => {
		if (now === null) {
			return null;
		}
		const next = getNextActiveEarlyBirdCutoff(
			pricingTiers,
			{ registrationOpensAt, registrationClosesAt, endAt },
			now,
		);
		if (next === null) {
			return null;
		}
		const label = formatEarlyBirdCountdown(next.cutoffMs, now.getTime());
		if (label === null) {
			return null;
		}
		return { label, categorySlug: next.categorySlug };
	}, [now, pricingTiers, registrationOpensAt, registrationClosesAt, endAt]);
}
