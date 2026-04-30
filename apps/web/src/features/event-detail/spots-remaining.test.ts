import { eventPublicCategorySchema } from "@repo/shared/schemas";
import { describe, expect, it } from "vitest";
import type { RegistrationState } from "./registration";
import {
	formatSpotsRemainingLabel,
	getSpotsRemainingDisplay,
	getSpotsRemainingDisplayThreshold,
} from "./spots-remaining";
import type { EventPublicCategory } from "./types";

function buildCategory(
	capacity: EventPublicCategory["capacity"] = {
		spotsTotal: 100,
		spotsRemaining: 20,
	},
): EventPublicCategory {
	const category = eventPublicCategorySchema.parse({
		name: "5K Fun Run",
		slug: "5k",
		distanceMeters: 5000,
		sortOrder: 0,
		capacity: { spotsTotal: 100, spotsRemaining: 20 },
	});
	return { ...category, capacity };
}

describe("spots remaining helpers", () => {
	it.each([
		[1, 1],
		[2, 1],
		[5, 1],
		[50, 10],
		[100, 20],
		[124, 25],
		[125, 25],
		[126, 25],
		[1000, 25],
		[Number.MAX_SAFE_INTEGER, 25],
	])("returns the display threshold for total %s", (total, expected) => {
		expect(getSpotsRemainingDisplayThreshold(total)).toBe(expected);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"returns a fail-safe zero threshold for invalid total %s",
		(total) => {
			expect(getSpotsRemainingDisplayThreshold(total)).toBe(0);
			expect(
				getSpotsRemainingDisplay(
					buildCategory({ spotsTotal: total, spotsRemaining: 1 }),
					"open",
				),
			).toBeNull();
		},
	);

	it.each([
		[1, "1 spot remaining"],
		[0, "0 spots remaining"],
		[2, "2 spots remaining"],
		[99, "99 spots remaining"],
	])("formats spots remaining label for %s", (count, expected) => {
		expect(formatSpotsRemainingLabel(count)).toBe(expected);
	});

	it.each([
		["open", true],
		["not_yet_open", true],
		["unknown", false],
		["closed_window", false],
		["event_ended", false],
	] satisfies Array<[RegistrationState, boolean]>)(
		"gates display by registration state %s",
		(state, shouldDisplay) => {
			const display = getSpotsRemainingDisplay(buildCategory(), state);

			if (shouldDisplay) {
				expect(display).toEqual({
					kind: "low-spots",
					count: 20,
					label: "20 spots remaining",
				});
			} else {
				expect(display).toBeNull();
			}
		},
	);

	it.each([
		"open",
		"not_yet_open",
		"unknown",
		"closed_window",
		"event_ended",
	] satisfies RegistrationState[])(
		"returns null for null capacity in %s state",
		(state) => {
			expect(getSpotsRemainingDisplay(buildCategory(null), state)).toBeNull();
		},
	);

	it.each(["open", "not_yet_open"] satisfies RegistrationState[])(
		"returns sold-out display in %s state",
		(state) => {
			expect(
				getSpotsRemainingDisplay(
					buildCategory({ spotsTotal: 100, spotsRemaining: 0 }),
					state,
				),
			).toEqual({ kind: "sold-out" });
		},
	);

	it("shows at the threshold boundary and hides just above it", () => {
		expect(
			getSpotsRemainingDisplay(
				buildCategory({ spotsTotal: 100, spotsRemaining: 20 }),
				"open",
			),
		).toEqual({
			kind: "low-spots",
			count: 20,
			label: "20 spots remaining",
		});
		expect(
			getSpotsRemainingDisplay(
				buildCategory({ spotsTotal: 100, spotsRemaining: 21 }),
				"open",
			),
		).toBeNull();
	});
});
