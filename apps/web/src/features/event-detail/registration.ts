import { useEffect, useMemo, useState } from "react";
import type { EventPublicDetail } from "./types";

/**
 * I-2.1.7 — Registration state for the public event CTA.
 *
 * Precedence after mount: `event_ended` > `closed_window` > `not_yet_open` > `open`.
 *
 * `unknown` is the SSR / pre-mount stable baseline. It never asserts
 * availability so the CDN-cached HTML can never lie about the registration
 * window. After mount, {@link useRegistrationState} refines the state.
 */
export type RegistrationState =
	| "unknown"
	| "open"
	| "not_yet_open"
	| "closed_window"
	| "event_ended";

export interface RegistrationWindowFields {
	registrationOpensAt: string | null;
	registrationClosesAt: string | null;
	endAt: string;
}

function parseTimestampMs(value: string | null): number | null {
	if (value === null) {
		return null;
	}
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Pure helper. Returns {@link RegistrationState} from a wall-clock and the
 * event's three time bounds.
 *
 * Boundary semantics:
 *   - `now < registrationOpensAt`         → `not_yet_open` (open boundary uses `<`).
 *   - `now >= registrationClosesAt`       → `closed_window`.
 *   - `now >= endAt`                       → `event_ended`.
 *
 * Defensive parsing:
 *   - Invalid `registrationOpensAt` (NaN) → treated as "bound not set".
 *   - Invalid `registrationClosesAt`      → fail-closed (treated as already-passed).
 *   - Invalid required `endAt`            → fail-safe to `event_ended`.
 */
export function getRegistrationState(
	event: RegistrationWindowFields,
	now: Date | null,
): RegistrationState {
	if (now === null) {
		return "unknown";
	}
	const nowMs = now.getTime();

	const endMs = parseTimestampMs(event.endAt);
	if (endMs === null || nowMs >= endMs) {
		return "event_ended";
	}

	if (event.registrationClosesAt !== null) {
		const closeMs = parseTimestampMs(event.registrationClosesAt);
		if (closeMs === null || nowMs >= closeMs) {
			return "closed_window";
		}
	}

	if (event.registrationOpensAt !== null) {
		const openMs = parseTimestampMs(event.registrationOpensAt);
		if (openMs !== null && nowMs < openMs) {
			return "not_yet_open";
		}
	}

	return "open";
}

/**
 * Single source of truth for the booking-flow URL on both the desktop +
 * mobile CTAs (and any test that asserts the link target). Phase 3 will
 * replace the placeholder route at `/events/:slug/register` with the real
 * booking page; this helper insulates callers from that move.
 */
export function getBookingHref(event: Pick<EventPublicDetail, "slug">): string {
	return `/events/${event.slug}/register`;
}

/**
 * Formats an ISO-8601 UTC timestamp in the event's IANA timezone with the
 * short timezone name (e.g. "IST") so cross-locale viewers can disambiguate.
 *
 * Uses explicit field options (year/month/day/hour/minute) instead of
 * `dateStyle`/`timeStyle` because some `Intl` engines reject the
 * combination of `dateStyle`/`timeStyle` with `timeZoneName`.
 *
 * Mirrors the {@link formatDeadline} fallback in
 * `public-event-pricing-breakdown.tsx`: on `RangeError` (unknown timezone),
 * fall back to the runtime locale (still with the short timezone label).
 */
export function formatRegistrationDate(
	value: string,
	timezone: string,
): string {
	const date = new Date(value);
	const fields = {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZoneName: "short",
	} as const;
	try {
		return new Intl.DateTimeFormat("en-IN", {
			...fields,
			timeZone: timezone,
		}).format(date);
	} catch {
		return new Intl.DateTimeFormat(undefined, fields).format(date);
	}
}

/**
 * Returns the soonest future boundary (ms epoch) among (opensAt, closesAt,
 * endAt) given a starting wall-clock, or `null` when none of the three are
 * still in the future. Used by {@link useRegistrationState} to schedule a
 * one-shot refresh so the CTA can transition state mid-page (e.g.
 * registration closes while the user is reading).
 */
export function getNextBoundaryMs(
	event: RegistrationWindowFields,
	now: Date,
): number | null {
	const candidates: number[] = [];
	const nowMs = now.getTime();
	const bounds: Array<string | null> = [
		event.registrationOpensAt,
		event.registrationClosesAt,
		event.endAt,
	];
	for (const value of bounds) {
		const ms = parseTimestampMs(value);
		if (ms !== null && ms > nowMs) {
			candidates.push(ms);
		}
	}
	if (candidates.length === 0) {
		return null;
	}
	return Math.min(...candidates);
}

/**
 * Largest delay accepted by Node's `setTimeout` without clamping
 * (`2 ** 31 - 1` ≈ 24.8 days). Larger values trigger
 * `TimeoutOverflowWarning` and are silently coerced to 1ms.
 */
const MAX_BOUNDARY_DELAY_MS = 2_147_483_647;

/**
 * SSR-safe registration-state hook.
 *
 * Returns `"unknown"` on SSR + first render so the cached HTML never
 * advertises a stale availability state. After mount the state refines from
 * `getRegistrationState(event, new Date())` and a single `setTimeout` is
 * scheduled at the next boundary; the chain repeats until no future
 * boundary remains. No interval polling — only precise per-boundary timers.
 */
export function useRegistrationState(
	event: RegistrationWindowFields,
): RegistrationState {
	const [now, setNow] = useState<Date | null>(null);
	// Capture primitive fields so the effect's dep list is the actual
	// boundary set — a parent that re-renders with a structurally equal
	// event object must not retrigger the schedule.
	const { registrationOpensAt, registrationClosesAt, endAt } = event;

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const fields: RegistrationWindowFields = {
			registrationOpensAt,
			registrationClosesAt,
			endAt,
		};

		function tick() {
			const current = new Date();
			setNow(current);
			const nextMs = getNextBoundaryMs(fields, current);
			if (nextMs === null) {
				return;
			}
			// +1ms so the `>=` comparator on the boundary registers as "passed".
			// Cap delay at the largest signed 32-bit integer (≈24.8 days)
			// because Node clamps larger values to 1ms (TimeoutOverflowWarning)
			// which would cause this chain to spin. When the timer fires we
			// re-check the boundary and schedule the next chunk if needed.
			const delay = Math.min(
				MAX_BOUNDARY_DELAY_MS,
				Math.max(1, nextMs - current.getTime() + 1),
			);
			timeoutId = setTimeout(tick, delay);
		}

		tick();
		return () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	}, [registrationOpensAt, registrationClosesAt, endAt]);

	return useMemo(() => getRegistrationState(event, now), [event, now]);
}
