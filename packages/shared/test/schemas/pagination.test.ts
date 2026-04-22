import { describe, expect, it } from "vitest";
import {
	cursorPaginationMetaSchema,
	cursorPaginationSchema,
	offsetPaginationMetaSchema,
	offsetPaginationSchema,
} from "../../src/schemas/pagination";

describe("offsetPaginationSchema", () => {
	it("applies defaults when no input", () => {
		const result = offsetPaginationSchema.parse({});
		expect(result).toEqual({ page: 1, limit: 20 });
	});

	it("parses string numbers via coercion", () => {
		const result = offsetPaginationSchema.parse({ page: "2", limit: "50" });
		expect(result).toEqual({ page: 2, limit: 50 });
	});

	it("respects provided values", () => {
		const result = offsetPaginationSchema.parse({ page: 3, limit: 10 });
		expect(result).toEqual({ page: 3, limit: 10 });
	});

	it("rejects page < 1", () => {
		expect(
			offsetPaginationSchema.safeParse({ page: 0 }).success,
		).toBe(false);
	});

	it("rejects limit > 100", () => {
		expect(
			offsetPaginationSchema.safeParse({ limit: 101 }).success,
		).toBe(false);
	});

	it("rejects limit < 1", () => {
		expect(
			offsetPaginationSchema.safeParse({ limit: 0 }).success,
		).toBe(false);
	});
});

describe("cursorPaginationSchema", () => {
	it("cursor is optional", () => {
		const result = cursorPaginationSchema.parse({});
		expect(result.cursor).toBeUndefined();
		expect(result.limit).toBe(20);
	});

	it("accepts cursor string", () => {
		const result = cursorPaginationSchema.parse({ cursor: "abc123" });
		expect(result.cursor).toBe("abc123");
	});

	it("applies default limit", () => {
		const result = cursorPaginationSchema.parse({ cursor: "x" });
		expect(result.limit).toBe(20);
	});

	it("rejects limit > 100", () => {
		expect(
			cursorPaginationSchema.safeParse({ limit: 101 }).success,
		).toBe(false);
	});
});

describe("offsetPaginationMetaSchema", () => {
	it("accepts valid meta object", () => {
		const meta = {
			page: 1,
			limit: 20,
			total: 100,
			totalPages: 5,
			hasNext: true,
			hasPrev: false,
		};
		expect(offsetPaginationMetaSchema.safeParse(meta).success).toBe(true);
	});

	it("rejects missing required fields", () => {
		expect(
			offsetPaginationMetaSchema.safeParse({ page: 1 }).success,
		).toBe(false);
	});
});

describe("cursorPaginationMetaSchema", () => {
	it("accepts valid meta with null nextCursor", () => {
		const meta = { nextCursor: null, hasMore: false, limit: 20 };
		expect(cursorPaginationMetaSchema.safeParse(meta).success).toBe(true);
	});

	it("accepts valid meta with string nextCursor", () => {
		const meta = { nextCursor: "cursor123", hasMore: true, limit: 20 };
		const result = cursorPaginationMetaSchema.safeParse(meta);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.nextCursor).toBe("cursor123");
		}
	});
});
