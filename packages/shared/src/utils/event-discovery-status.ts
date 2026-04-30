/**
 * Discovery-surface event statuses for public listing/card availability.
 *
 * This enum is intentionally distinct from the persisted lifecycle
 * `EVENT_STATUSES` in `packages/shared/src/constants/event.ts`
 * (`draft`, `under_review`, `published`, `completed`, `cancelled`). Discovery
 * status is derived from the registration window and per-category capacity at
 * read time, and is never persisted.
 */
import { z } from "zod/v4";

/**
 * Discovery status values for list/card surfaces. Use the event-detail
 * `RegistrationState` only for CTA-internal state.
 */
export const EVENT_DISCOVERY_STATUSES = [
	"upcoming",
	"registration_open",
	"registration_closed",
	"sold_out",
	"event_ended",
] as const;

export type EventDiscoveryStatus = (typeof EVENT_DISCOVERY_STATUSES)[number];

export const eventDiscoveryStatusSchema = z.enum(EVENT_DISCOVERY_STATUSES);

export const EVENT_DISCOVERY_STATUS_LABELS: Record<
	EventDiscoveryStatus,
	string
> = {
	upcoming: "Upcoming",
	registration_open: "Registration open",
	registration_closed: "Registration closed",
	sold_out: "Sold out",
	event_ended: "Event ended",
};

export interface EventDiscoveryStatusCategoryInput {
	capacity: { spotsTotal: number; spotsRemaining: number } | null;
}

export interface EventDiscoveryStatusInput {
	registrationOpensAt: string | null;
	registrationClosesAt: string | null;
	endAt: string;
	categories: ReadonlyArray<EventDiscoveryStatusCategoryInput>;
}

function parseTimestampMs(value: string): number | null {
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Returns a derived discovery status from event bounds and category capacity.
 *
 * Use this for discovery/listing/card surfaces. The event-detail registration
 * CTA keeps its finer-grained `RegistrationState` because that state also
 * models SSR `unknown` and CTA-specific transitions.
 */
export function getEventDiscoveryStatus(
	input: EventDiscoveryStatusInput,
	now: Date,
): EventDiscoveryStatus {
	const nowMs = now.getTime();
	if (!Number.isFinite(nowMs)) {
		return "event_ended";
	}

	const endMs = parseTimestampMs(input.endAt);
	if (endMs === null || nowMs >= endMs) {
		return "event_ended";
	}

	if (input.registrationClosesAt !== null) {
		const closeMs = parseTimestampMs(input.registrationClosesAt);
		if (closeMs === null || nowMs >= closeMs) {
			return "registration_closed";
		}
	}

	if (input.registrationOpensAt !== null) {
		const openMs = parseTimestampMs(input.registrationOpensAt);
		if (openMs !== null && nowMs < openMs) {
			return "upcoming";
		}
	}

	const boundedCategories = input.categories.filter(
		(category) => category.capacity !== null,
	);
	if (
		boundedCategories.length === 0 ||
		boundedCategories.length !== input.categories.length
	) {
		return "registration_open";
	}

	if (
		boundedCategories.every(
			(category) => category.capacity?.spotsRemaining === 0,
		)
	) {
		return "sold_out";
	}

	return "registration_open";
}
