import { describe, expect, it } from "vitest";
import { EVENT_DISTANCE_CATEGORY_PRESETS } from "../../src/constants/event";
import {
	defaultEventCategoriesConfig,
	type EventCategorySlug,
	eventCategoriesConfigSchema,
	eventCategoryConfigSchema,
	eventCategoryRecordSchema,
	eventCategorySlugSchema,
} from "../../src/schemas/event-category";

describe("eventCategorySlugSchema", () => {
	it("accepts normalized category slugs", () => {
		const slug: EventCategorySlug =
			eventCategorySlugSchema.parse("half-marathon");

		expect(slug).toBe("half-marathon");
	});

	it.each([
		"",
		"5K",
		"half marathon",
		"half_marathon",
		"-5k",
		"5k-",
	])('rejects invalid category slug "%s"', (slug) => {
		expect(eventCategorySlugSchema.safeParse(slug).success).toBe(false);
	});
});

describe("eventCategoryConfigSchema", () => {
	it("accepts V1 distance category presets", () => {
		for (const [index, preset] of EVENT_DISTANCE_CATEGORY_PRESETS.entries()) {
			expect(
				eventCategoryConfigSchema.parse({
					name: preset.label,
					slug: preset.slug,
					distanceMeters: preset.distanceMeters,
					sortOrder: index,
				}),
			).toMatchObject({
				name: preset.label,
				slug: preset.slug,
				distanceMeters: preset.distanceMeters,
				sortOrder: index,
			});
		}
	});

	it("rejects non-positive distances", () => {
		const result = eventCategoryConfigSchema.safeParse({
			name: "5K",
			slug: "5k",
			distanceMeters: 0,
			sortOrder: 0,
		});

		expect(result.success).toBe(false);
	});
});

describe("eventCategoriesConfigSchema", () => {
	it("accepts the default 5K, 10K, and half-marathon configuration", () => {
		const result = eventCategoriesConfigSchema.parse(
			defaultEventCategoriesConfig,
		);

		expect(result.categories.map((category) => category.slug)).toEqual([
			"5k",
			"10k",
			"half-marathon",
		]);
	});

	it("rejects duplicate slugs, names, and sort orders", () => {
		const result = eventCategoriesConfigSchema.safeParse({
			categories: [
				{ name: "5K", slug: "5k", distanceMeters: 5000, sortOrder: 0 },
				{ name: "5k", slug: "5k", distanceMeters: 5000, sortOrder: 0 },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Category slugs must be unique per event",
						path: ["categories", 1, "slug"],
					}),
					expect.objectContaining({
						message: "Category names must be unique per event",
						path: ["categories", 1, "name"],
					}),
					expect.objectContaining({
						message: "Category sort orders must be unique per event",
						path: ["categories", 1, "sortOrder"],
					}),
				]),
			);
		}
	});
});

describe("eventCategoryRecordSchema", () => {
	it("accepts persisted event category records", () => {
		const result = eventCategoryRecordSchema.parse({
			id: "11111111-1111-4111-8111-111111111111",
			eventId: "22222222-2222-4222-8222-222222222222",
			name: "10K",
			slug: "10k",
			distanceMeters: 10000,
			sortOrder: 1,
			spotsTotal: 100,
			spotsRemaining: 100,
			createdAt: "2026-04-26T12:00:00.000Z",
			updatedAt: "2026-04-26T12:00:00.000Z",
		});

		expect(result.slug).toBe("10k");
	});
});
