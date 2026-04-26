import {
	createEventBaseSchema,
	eventCategoriesConfigSchema,
	eventCategoryRecordSchema,
	eventSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import { z } from "zod/v4";

export const createEventBodySchema = createEventBaseSchema;

export const eventIdParamsSchema = z.object({
	eventId: uuidSchema,
});

export const createEventResponseSchema = z.object({
	success: z.literal(true),
	data: eventSchema,
});

export const eventCategoriesBodySchema = eventCategoriesConfigSchema;

export const eventCategoriesResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		categories: z.array(eventCategoryRecordSchema),
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
