import type { RegistrationState } from "./registration";
import type { EventPublicCategory } from "./types";

export const SPOTS_REMAINING_MAX_DISPLAY_THRESHOLD = 25;
export const SPOTS_REMAINING_DISPLAY_THRESHOLD_RATIO = 0.2;

export function getSpotsRemainingDisplayThreshold(spotsTotal: number): number {
	if (spotsTotal <= 0 || !Number.isFinite(spotsTotal)) {
		return 0;
	}
	return Math.min(
		SPOTS_REMAINING_MAX_DISPLAY_THRESHOLD,
		Math.ceil(SPOTS_REMAINING_DISPLAY_THRESHOLD_RATIO * spotsTotal),
	);
}

export function formatSpotsRemainingLabel(count: number): string {
	return count === 1 ? "1 spot remaining" : `${count} spots remaining`;
}

export type SpotsRemainingDisplay =
	| { kind: "sold-out" }
	| { kind: "low-spots"; count: number; label: string };

export function getSpotsRemainingDisplay(
	category: EventPublicCategory,
	state: RegistrationState,
): SpotsRemainingDisplay | null {
	if (state !== "open" && state !== "not_yet_open") {
		return null;
	}
	if (category.capacity === null) {
		return null;
	}

	const { spotsTotal, spotsRemaining } = category.capacity;
	if (spotsRemaining === 0) {
		return { kind: "sold-out" };
	}

	const threshold = getSpotsRemainingDisplayThreshold(spotsTotal);
	if (spotsRemaining > 0 && spotsRemaining <= threshold) {
		return {
			kind: "low-spots",
			count: spotsRemaining,
			label: formatSpotsRemainingLabel(spotsRemaining),
		};
	}

	return null;
}
