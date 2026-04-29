import {
	createEventInputSchema,
	eventCategoriesConfigSchema,
	eventCategoryCapacityUpdateSchema,
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
	eventPublicLookupResponseSchema,
	eventRegistrationFormSchema,
	eventSlugSchema,
	eventSchema,
	publishedEventPatchSchema,
	publishEventResponseSchema,
	publishReadinessResponseSchema,
	unpublishEventResponseSchema,
	updateEventInputSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

export const createEventBodySchema = createEventInputSchema;

export const updateEventBodySchema = updateEventInputSchema;

export const eventIdParamsSchema = z.object({
	eventId: uuidSchema,
});

export const eventSlugParamsSchema = z.object({
	slug: eventSlugSchema,
});

export const eventImageIdParamsSchema = eventIdParamsSchema.extend({
	imageId: eventImageConfirmRequestSchema.shape.imageId,
});

export const createEventResponseSchema = z.object({
	success: z.literal(true),
	data: eventSchema,
});

export const updateEventResponseSchema = createEventResponseSchema;

export const eventPublicLookupHttpResponseSchema = z.object({
	success: z.literal(true),
	data: eventPublicLookupResponseSchema,
});

export {
	publishEventResponseSchema,
	publishReadinessResponseSchema,
	unpublishEventResponseSchema,
};

export const eventCategoriesBodySchema = eventCategoriesConfigSchema;

export const eventPoliciesBodySchema = eventPoliciesConfigSchema;

export const eventCategoryIdParamsSchema = eventIdParamsSchema.extend({
	categoryId: uuidSchema,
});

export const eventCategoryCapacityBodySchema =
	eventCategoryCapacityUpdateSchema;

export const eventCategoryCapacityResponseSchema = z.object({
	success: z.literal(true),
	data: eventCategoryRecordSchema,
});

export const publishedEventPatchBodySchema = publishedEventPatchSchema;

export const publishedEventPatchResponseSchema = z.object({
	success: z.literal(true),
	data: eventSchema,
});

export const eventRegistrationFormBodySchema = eventRegistrationFormSchema;

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

export const eventRegistrationFormResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		eventId: uuidSchema,
		formSchema: eventRegistrationFormSchema,
		formSchemaVersion: eventRegistrationFormSchema.shape.version,
		updatedAt: z.string().datetime(),
	}),
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
