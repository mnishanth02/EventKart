import { z } from "zod/v4";
import {
	cursorPaginationMetaSchema,
	offsetPaginationMetaSchema,
} from "./pagination.js";

/** Generic success response wrapper. */
export function successResponseSchema<T extends z.ZodType>(dataSchema: T) {
	return z.object({
		success: z.literal(true),
		data: dataSchema,
	});
}

/** Standard error response. */
export const errorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});

/** Offset-paginated response wrapper. */
export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
	return z.object({
		success: z.literal(true),
		data: z.array(itemSchema),
		meta: offsetPaginationMetaSchema,
	});
}

/** Cursor-paginated response wrapper. */
export function cursorPaginatedResponseSchema<T extends z.ZodType>(
	itemSchema: T,
) {
	return z.object({
		success: z.literal(true),
		data: z.array(itemSchema),
		meta: cursorPaginationMetaSchema,
	});
}

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
