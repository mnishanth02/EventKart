import { z } from "zod/v4";

/** Offset-based pagination request parameters. */
export const offsetPaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Cursor-based pagination request parameters. */
export const cursorPaginationSchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Offset pagination response metadata. */
export const offsetPaginationMetaSchema = z.object({
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
	hasNext: z.boolean(),
	hasPrev: z.boolean(),
});

/** Cursor pagination response metadata. */
export const cursorPaginationMetaSchema = z.object({
	nextCursor: z.string().nullable(),
	hasMore: z.boolean(),
	limit: z.number().int(),
});

export type OffsetPagination = z.infer<typeof offsetPaginationSchema>;
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
export type OffsetPaginationMeta = z.infer<typeof offsetPaginationMetaSchema>;
export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>;
