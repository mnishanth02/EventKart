import { createEventBaseSchema, eventSchema } from "@repo/shared/schemas";
import { z } from "zod/v4";

export const createEventBodySchema = createEventBaseSchema;

export const createEventResponseSchema = z.object({
	success: z.literal(true),
	data: eventSchema,
});

export const eventErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});
