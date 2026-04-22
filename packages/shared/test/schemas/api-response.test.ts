import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import {
	cursorPaginatedResponseSchema,
	errorResponseSchema,
	paginatedResponseSchema,
	successResponseSchema,
} from "../../src/schemas/api-response";

const itemSchema = z.object({ id: z.number(), name: z.string() });

describe("successResponseSchema", () => {
	const schema = successResponseSchema(itemSchema);

	it("wraps data with success: true", () => {
		const input = { success: true, data: { id: 1, name: "Test" } };
		const result = schema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.success).toBe(true);
			expect(result.data.data).toEqual({ id: 1, name: "Test" });
		}
	});

	it("validates inner schema", () => {
		const input = { success: true, data: { id: "not-a-number", name: 42 } };
		expect(schema.safeParse(input).success).toBe(false);
	});
});

describe("errorResponseSchema", () => {
	it("accepts valid error response", () => {
		const input = {
			success: false,
			error: { code: "NOT_FOUND", message: "Resource not found" },
		};
		const result = errorResponseSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it("details is optional", () => {
		const withDetails = {
			success: false,
			error: {
				code: "VALIDATION",
				message: "Invalid input",
				details: { field: "email" },
			},
		};
		const withoutDetails = {
			success: false,
			error: { code: "VALIDATION", message: "Invalid input" },
		};
		expect(errorResponseSchema.safeParse(withDetails).success).toBe(true);
		expect(errorResponseSchema.safeParse(withoutDetails).success).toBe(true);
	});

	it("rejects when success is not false", () => {
		const input = {
			success: true,
			error: { code: "ERR", message: "fail" },
		};
		expect(errorResponseSchema.safeParse(input).success).toBe(false);
	});
});

describe("paginatedResponseSchema", () => {
	const schema = paginatedResponseSchema(itemSchema);

	it("wraps array + offset meta", () => {
		const input = {
			success: true,
			data: [{ id: 1, name: "A" }],
			meta: {
				page: 1,
				limit: 20,
				total: 1,
				totalPages: 1,
				hasNext: false,
				hasPrev: false,
			},
		};
		const result = schema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.data).toHaveLength(1);
			expect(result.data.meta.total).toBe(1);
		}
	});
});

describe("cursorPaginatedResponseSchema", () => {
	const schema = cursorPaginatedResponseSchema(itemSchema);

	it("wraps array + cursor meta", () => {
		const input = {
			success: true,
			data: [{ id: 1, name: "A" }],
			meta: { nextCursor: "abc", hasMore: true, limit: 20 },
		};
		const result = schema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.data).toHaveLength(1);
			expect(result.data.meta.nextCursor).toBe("abc");
		}
	});
});
