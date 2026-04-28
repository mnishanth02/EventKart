import { z } from "zod/v4";
import {
	EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT,
	EVENT_PRICING_MAX_PRICE_PAISE,
	EVENT_PRICING_MIN_PRICE_PAISE,
} from "../constants/event.js";
import { datetimeSchema } from "./date.js";
import { eventCategoryRecordSchema } from "./event-category.js";
import { uuidSchema } from "./id.js";

export const eventPriceSchema = z
	.number()
	.int("Price must be a whole number of paise")
	.min(
		EVENT_PRICING_MIN_PRICE_PAISE,
		`Price must be at least ${EVENT_PRICING_MIN_PRICE_PAISE} paise`,
	)
	.max(
		EVENT_PRICING_MAX_PRICE_PAISE,
		`Price must be at most ${EVENT_PRICING_MAX_PRICE_PAISE.toLocaleString("en-IN")} paise`,
	);

export const eventPricingTierConfigSchema = z
	.object({
		eventCategoryId: uuidSchema,
		basePrice: eventPriceSchema,
		earlyBirdPrice: eventPriceSchema.nullable().optional(),
		earlyBirdDeadline: datetimeSchema.nullable().optional(),
	})
	.superRefine((tier, ctx) => {
		const hasEarlyBirdPrice = tier.earlyBirdPrice != null;
		const hasEarlyBirdDeadline = tier.earlyBirdDeadline != null;
		if (hasEarlyBirdPrice !== hasEarlyBirdDeadline) {
			ctx.addIssue({
				code: "custom",
				message: hasEarlyBirdPrice
					? "Early-bird deadline is required when early-bird price is set"
					: "Early-bird price is required when early-bird deadline is set",
				path: [hasEarlyBirdPrice ? "earlyBirdDeadline" : "earlyBirdPrice"],
			});
		}
		if (tier.earlyBirdPrice != null && tier.earlyBirdPrice >= tier.basePrice) {
			ctx.addIssue({
				code: "custom",
				message: "Early-bird price must be lower than base price",
				path: ["earlyBirdPrice"],
			});
		}
	});

export const eventPricingConfigSchema = z
	.object({
		tiers: z
			.array(eventPricingTierConfigSchema)
			.min(1, "At least one pricing tier is required")
			.max(
				EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT,
				`Events can have at most ${EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT} pricing tiers`,
			),
	})
	.superRefine((config, ctx) => {
		const seenCategoryIds = new Map<string, number>();
		config.tiers.forEach((tier, index) => {
			const existingIndex = seenCategoryIds.get(tier.eventCategoryId);
			if (existingIndex !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Pricing tiers must be unique per event category",
					path: ["tiers", index, "eventCategoryId"],
				});
				ctx.addIssue({
					code: "custom",
					message: "Pricing tiers must be unique per event category",
					path: ["tiers", existingIndex, "eventCategoryId"],
				});
			}
			seenCategoryIds.set(tier.eventCategoryId, index);
		});
	});

export const eventPricingTierRecordSchema = z.object({
	id: uuidSchema,
	eventId: uuidSchema,
	eventCategoryId: uuidSchema,
	basePrice: eventPriceSchema,
	earlyBirdPrice: eventPriceSchema.nullable(),
	earlyBirdDeadline: datetimeSchema.nullable(),
	createdAt: datetimeSchema,
	updatedAt: datetimeSchema,
});

export const eventPricingTierWithCategorySchema =
	eventPricingTierRecordSchema.extend({
		category: eventCategoryRecordSchema,
	});

export type EventPricingTierConfigInput = z.input<
	typeof eventPricingTierConfigSchema
>;
export type EventPricingTierConfig = z.output<
	typeof eventPricingTierConfigSchema
>;
export type EventPricingConfigInput = z.input<typeof eventPricingConfigSchema>;
export type EventPricingConfig = z.output<typeof eventPricingConfigSchema>;
export type EventPricingTierRecord = z.infer<
	typeof eventPricingTierRecordSchema
>;
export type EventPricingTierWithCategory = z.infer<
	typeof eventPricingTierWithCategorySchema
>;
