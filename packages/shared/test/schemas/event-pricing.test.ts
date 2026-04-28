import { describe, expect, it } from "vitest";
import {
	EVENT_PRICING_MAX_PRICE_PAISE,
	EVENT_PRICING_MIN_PRICE_PAISE,
} from "../../src/constants/event";
import {
	eventPricingConfigSchema,
	eventPricingTierRecordSchema,
} from "../../src/schemas/event-pricing";

const categoryId = "11111111-1111-4111-8111-111111111111";
const otherCategoryId = "22222222-2222-4222-8222-222222222222";

describe("eventPricingConfigSchema", () => {
	it("accepts base-only pricing tiers", () => {
		const result = eventPricingConfigSchema.parse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 75_000,
				},
			],
		});

		expect(result.tiers[0]).toMatchObject({
			eventCategoryId: categoryId,
			basePrice: 75_000,
		});
	});

	it("accepts early-bird pricing lower than the base price", () => {
		const result = eventPricingConfigSchema.parse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 100_000,
					earlyBirdPrice: 75_000,
					earlyBirdDeadline: "2026-04-26T12:00:00.000Z",
				},
				{
					eventCategoryId: otherCategoryId,
					basePrice: 150_000,
				},
			],
		});

		expect(result.tiers[0]?.earlyBirdPrice).toBe(75_000);
	});

	it("rejects duplicate event category pricing tiers", () => {
		const result = eventPricingConfigSchema.safeParse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 75_000,
				},
				{
					eventCategoryId: categoryId,
					basePrice: 100_000,
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Pricing tiers must be unique per event category",
						path: ["tiers", 1, "eventCategoryId"],
					}),
				]),
			);
		}
	});

	it.each([
		{
			name: "below minimum",
			basePrice: EVENT_PRICING_MIN_PRICE_PAISE - 1,
		},
		{
			name: "above maximum",
			basePrice: EVENT_PRICING_MAX_PRICE_PAISE + 1,
		},
		{
			name: "fractional",
			basePrice: 10_000.5,
		},
	])("rejects invalid price amounts: $name", ({ basePrice }) => {
		const result = eventPricingConfigSchema.safeParse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice,
				},
			],
		});

		expect(result.success).toBe(false);
	});

	it("rejects early-bird price without a deadline", () => {
		const result = eventPricingConfigSchema.safeParse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 100_000,
					earlyBirdPrice: 75_000,
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message:
							"Early-bird deadline is required when early-bird price is set",
						path: ["tiers", 0, "earlyBirdDeadline"],
					}),
				]),
			);
		}
	});

	it("rejects early-bird deadline without a price", () => {
		const result = eventPricingConfigSchema.safeParse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 100_000,
					earlyBirdDeadline: "2026-04-26T12:00:00.000Z",
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message:
							"Early-bird price is required when early-bird deadline is set",
						path: ["tiers", 0, "earlyBirdPrice"],
					}),
				]),
			);
		}
	});

	it("rejects early-bird price greater than or equal to base price", () => {
		const result = eventPricingConfigSchema.safeParse({
			tiers: [
				{
					eventCategoryId: categoryId,
					basePrice: 100_000,
					earlyBirdPrice: 100_000,
					earlyBirdDeadline: "2026-04-26T12:00:00.000Z",
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message: "Early-bird price must be lower than base price",
						path: ["tiers", 0, "earlyBirdPrice"],
					}),
				]),
			);
		}
	});
});

describe("eventPricingTierRecordSchema", () => {
	it("accepts persisted pricing tier records with nullable early-bird fields", () => {
		const result = eventPricingTierRecordSchema.parse({
			id: "33333333-3333-4333-8333-333333333333",
			eventId: "44444444-4444-4444-8444-444444444444",
			eventCategoryId: categoryId,
			basePrice: 75_000,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
			createdAt: "2026-04-26T12:00:00.000Z",
			updatedAt: "2026-04-26T12:00:00.000Z",
		});

		expect(result.earlyBirdPrice).toBeNull();
	});
});
