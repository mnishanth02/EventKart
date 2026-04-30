import { describe, expect, it } from "vitest";
import {
	formatCardDateRange,
	formatCategoryList,
	formatLocation,
} from "./format";
import type { EventCardData } from "./types";

const categories: EventCardData["categories"] = [
	{
		name: "5K",
		slug: categorySlug("5k"),
		distanceMeters: 5000,
		capacity: { spotsTotal: 100, spotsRemaining: 50 },
	},
	{
		name: "10K",
		slug: categorySlug("10k"),
		distanceMeters: 10000,
		capacity: { spotsTotal: 100, spotsRemaining: 50 },
	},
	{
		name: "21K",
		slug: categorySlug("21k"),
		distanceMeters: 21097,
		capacity: { spotsTotal: 100, spotsRemaining: 50 },
	},
	{
		name: "42K",
		slug: categorySlug("42k"),
		distanceMeters: 42195,
		capacity: { spotsTotal: 100, spotsRemaining: 50 },
	},
	{
		name: "Kids",
		slug: categorySlug("kids"),
		distanceMeters: 1000,
		capacity: { spotsTotal: 100, spotsRemaining: 50 },
	},
];

function categorySlug(value: string): EventCardData["categories"][number]["slug"] {
	return value as EventCardData["categories"][number]["slug"];
}

describe("formatCardDateRange", () => {
	it("formats a same-day range with equal start and end timestamps", () => {
		expect(
			formatCardDateRange(
				"2026-08-15T00:30:00.000Z",
				"2026-08-15T00:30:00.000Z",
				"Asia/Kolkata",
			),
		).toBe("15 Aug 2026 · 6:00 am");
	});

	it("formats a same-day range with different times", () => {
		expect(
			formatCardDateRange(
				"2026-08-15T00:30:00.000Z",
				"2026-08-15T12:30:00.000Z",
				"Asia/Kolkata",
			),
		).toBe("15 Aug 2026 · 6:00 am – 6:00 pm");
	});

	it("formats a multi-day same-month range", () => {
		expect(
			formatCardDateRange(
				"2026-08-15T00:30:00.000Z",
				"2026-08-16T03:30:00.000Z",
				"Asia/Kolkata",
			),
		).toBe("15–16 Aug 2026 · 6:00 am – 9:00 am");
	});

	it("formats a cross-month same-year range", () => {
		expect(
			formatCardDateRange(
				"2026-08-31T00:30:00.000Z",
				"2026-09-01T03:30:00.000Z",
				"Asia/Kolkata",
			),
		).toBe("31 Aug – 1 Sept 2026 · 6:00 am – 9:00 am");
	});

	it("formats a cross-year range", () => {
		expect(
			formatCardDateRange(
				"2026-12-31T00:30:00.000Z",
				"2027-01-01T03:30:00.000Z",
				"Asia/Kolkata",
			),
		).toBe("31 Dec 2026 – 1 Jan 2027 · 6:00 am – 9:00 am");
	});

	it("falls back when timezone is invalid", () => {
		expect(() =>
			formatCardDateRange(
				"2026-08-15T00:30:00.000Z",
				"2026-08-15T03:30:00.000Z",
				"Not/A_Timezone",
			),
		).not.toThrow();
	});
});

describe("formatCategoryList", () => {
	it("formats zero categories", () => {
		expect(formatCategoryList([])).toBe("");
	});

	it("formats one category", () => {
		expect(formatCategoryList(categories.slice(0, 1))).toBe("5K");
	});

	it("formats two categories", () => {
		expect(formatCategoryList(categories.slice(0, 2))).toBe("5K and 10K");
	});

	it("formats three categories", () => {
		expect(formatCategoryList(categories.slice(0, 3))).toBe("5K, 10K and 21K");
	});

	it("formats overflow categories", () => {
		expect(formatCategoryList(categories)).toBe("5K, 10K and 21K +2 more");
	});
});

describe("formatLocation", () => {
	it("omits venue when it matches city", () => {
		expect(formatLocation("Coimbatore", "Coimbatore")).toBe("Coimbatore");
	});

	it("includes distinct venue before city", () => {
		expect(formatLocation("Coimbatore", "Race Course Grounds")).toBe(
			"Race Course Grounds, Coimbatore",
		);
	});
});
