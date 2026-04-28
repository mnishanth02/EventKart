import { describe, expect, it } from "vitest";
import { type EventSlug, eventSlugSchema } from "../../src/schemas/event-slug";
import {
	EVENT_SLUG_MAX_LENGTH,
	normalizeEventSlug,
} from "../../src/utils/slug";

describe("eventSlugSchema", () => {
	it("accepts normalized event slugs", () => {
		const slug = normalizeEventSlug("Crème Brûlée Festival 2025");

		expect(eventSlugSchema.parse(slug)).toBe("creme-brulee-festival-2025");
	});

	it("provides a branded event slug type", () => {
		const slug: EventSlug = eventSlugSchema.parse("event-2025");

		expect(slug).toBe("event-2025");
	});

	it("accepts minimum and maximum length slugs", () => {
		expect(eventSlugSchema.safeParse("a").success).toBe(true);
		expect(
			eventSlugSchema.safeParse("a".repeat(EVENT_SLUG_MAX_LENGTH)).success,
		).toBe(true);
	});

	it.each([
		"",
		"Event",
		"event slug",
		"event_slug",
		"-event",
		"event-",
	])('rejects invalid slug "%s"', (slug) => {
		expect(eventSlugSchema.safeParse(slug).success).toBe(false);
	});

	it("rejects repeated separators", () => {
		expect(eventSlugSchema.safeParse("event--slug").success).toBe(false);
	});

	it("rejects slugs longer than the maximum length", () => {
		expect(
			eventSlugSchema.safeParse("a".repeat(EVENT_SLUG_MAX_LENGTH + 1)).success,
		).toBe(false);
	});
});
