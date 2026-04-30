import { z } from "zod/v4";
import { datetimeSchema } from "./date.js";
import { eventCategorySlugSchema } from "./event-category.js";
import {
	eventPublicCategoryCapacitySchema,
	eventPublicImageSchema,
	eventPublicPricingTierSchema,
} from "./event-public-detail.js";
import { eventSlugSchema } from "./event-slug.js";

export const eventPublicCardCategorySchema = z.object({
	name: z.string().min(1),
	slug: eventCategorySlugSchema,
	distanceMeters: z.number().int().positive(),
	capacity: eventPublicCategoryCapacitySchema.nullable(),
});

export type EventPublicCardCategory = z.infer<
	typeof eventPublicCardCategorySchema
>;

export const eventPublicCardSchema = z.object({
	slug: eventSlugSchema,
	title: z.string().min(1),
	startAt: datetimeSchema,
	endAt: datetimeSchema,
	timezone: z.string().min(1),
	city: z.string().min(1),
	venueName: z.string().min(1),
	registrationOpensAt: datetimeSchema.nullable(),
	registrationClosesAt: datetimeSchema.nullable(),
	isPaid: z.boolean(),
	heroImage: eventPublicImageSchema.nullable(),
	categories: z.array(eventPublicCardCategorySchema),
	pricingTiers: z.array(eventPublicPricingTierSchema),
});

export type EventPublicCard = z.infer<typeof eventPublicCardSchema>;
