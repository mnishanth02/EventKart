import {
	createEventBaseSchema,
	eventCategoriesConfigSchema,
	eventCategoryRecordSchema,
	eventImageConfirmRequestSchema,
	eventImageDeleteRequestSchema,
	eventImageListQuerySchema,
	eventImageSchema,
	eventImagesResponseSchema,
	eventImageUploadUrlRequestSchema,
	eventImageUploadUrlResponseSchema,
	eventPoliciesConfigSchema,
	eventPoliciesRecordSchema,
	eventPricingConfigSchema,
	eventPricingTierWithCategorySchema,
	eventSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

export const createEventBodySchema = createEventBaseSchema;

export const eventIdParamsSchema = z.object({
	eventId: uuidSchema,
});

export const eventImageIdParamsSchema = eventIdParamsSchema.extend({
	imageId: eventImageConfirmRequestSchema.shape.imageId,
});

export const createEventResponseSchema = z.object({
	success: z.literal(true),
	data: eventSchema,
});

export const eventCategoriesBodySchema = eventCategoriesConfigSchema;

export const eventPoliciesBodySchema = eventPoliciesConfigSchema;

export const eventPricingBodySchema = eventPricingConfigSchema;

export const eventImageUploadBodySchema = eventImageUploadUrlRequestSchema;

export const eventImagesQuerySchema = eventImageListQuerySchema;

export const eventCategoriesResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		categories: z.array(eventCategoryRecordSchema),
	}),
});

export const eventPricingResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		tiers: z.array(eventPricingTierWithCategorySchema),
	}),
});

export const eventPoliciesResponseSchema = z.object({
	success: z.literal(true),
	data: eventPoliciesRecordSchema,
});

export const eventImageUploadResponseSchema = z.object({
	success: z.literal(true),
	data: eventImageUploadUrlResponseSchema,
});

export const eventImageConfirmResponseSchema = z.object({
	success: z.literal(true),
	data: eventImageSchema,
});

export const eventImagesListResponseSchema = z.object({
	success: z.literal(true),
	data: eventImagesResponseSchema,
});

export const eventImageDeleteResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		deleted: z.literal(true),
		imageId: eventImageDeleteRequestSchema.shape.imageId,
		kind: eventImageSchema.shape.kind,
	}),
});

export const eventErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});
