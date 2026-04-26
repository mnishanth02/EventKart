import { describe, expect, it } from "vitest";
import {
	appendEventSlugSuffix,
	EVENT_SLUG_FALLBACK,
	EVENT_SLUG_MAX_LENGTH,
	normalizeEventSlug,
} from "../../src/utils/slug";

describe("normalizeEventSlug", () => {
	it.each([
		["  Summer   Fest 2025  ", "summer-fest-2025"],
		["Summer---Fest___2025", "summer-fest-2025"],
		["VIP Launch: React/Node.js @ 7pm!", "vip-launch-react-node-js-7pm"],
		["John's big party", "johns-big-party"],
		["Artist’s Night", "artists-night"],
	])('normalizes "%s" to "%s"', (input, expected) => {
		expect(normalizeEventSlug(input)).toBe(expected);
	});

	it("normalizes Unicode diacritics and common Latin variants", () => {
		expect(normalizeEventSlug("Crème Brûlée à São Paulo")).toBe(
			"creme-brulee-a-sao-paulo",
		);
		expect(normalizeEventSlug("Łódź Straße")).toBe("lodz-strasse");
	});

	it("removes unsupported punctuation and collapses separators", () => {
		expect(normalizeEventSlug("::Hello@@@World!!!")).toBe("hello-world");
	});

	it("uses a deterministic fallback for empty slugs", () => {
		expect(normalizeEventSlug("")).toBe(EVENT_SLUG_FALLBACK);
		expect(normalizeEventSlug("!!!")).toBe(EVENT_SLUG_FALLBACK);
		expect(normalizeEventSlug("東京")).toBe(EVENT_SLUG_FALLBACK);
	});

	it("normalizes a custom fallback", () => {
		expect(normalizeEventSlug("!!!", { fallback: "  My Fallback! " })).toBe(
			"my-fallback",
		);
	});

	it("falls back to the default when the custom fallback is empty after normalization", () => {
		expect(normalizeEventSlug("!!!", { fallback: "東京" })).toBe(
			EVENT_SLUG_FALLBACK,
		);
	});

	it("enforces the default maximum length", () => {
		const slug = normalizeEventSlug("a".repeat(EVENT_SLUG_MAX_LENGTH + 20));

		expect(slug).toHaveLength(EVENT_SLUG_MAX_LENGTH);
	});

	it("enforces a custom maximum length and trims trailing separators", () => {
		expect(normalizeEventSlug("one two three", { maxLength: 7 })).toBe(
			"one-two",
		);
	});
});

describe("appendEventSlugSuffix", () => {
	it("appends a positive numeric suffix", () => {
		expect(appendEventSlugSuffix("summer-festival", 2)).toBe(
			"summer-festival-2",
		);
	});

	it("normalizes the base slug before appending", () => {
		expect(appendEventSlugSuffix(" Summer Festival! ", 12)).toBe(
			"summer-festival-12",
		);
	});

	it("respects maximum length when appending a suffix", () => {
		expect(appendEventSlugSuffix("one two three", 2, { maxLength: 9 })).toBe(
			"one-two-2",
		);
	});

	it("uses the deterministic fallback when the base slug is empty", () => {
		expect(appendEventSlugSuffix("!!!", 2)).toBe("event-2");
	});

	it.each([
		0,
		-1,
		1.5,
		Number.NaN,
	])("throws for invalid suffix %s", (suffix) => {
		expect(() => appendEventSlugSuffix("event", suffix)).toThrow(RangeError);
	});
});
