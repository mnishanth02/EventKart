import { describe, expect, it } from "vitest";
import { emailSchema } from "../../src/schemas/email";

describe("emailSchema", () => {
	it("accepts valid email", () => {
		const result = emailSchema.safeParse("user@example.com");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("user@example.com");
		}
	});

	it("lowercases email", () => {
		const result = emailSchema.safeParse("User@Example.COM");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("user@example.com");
		}
	});

	it("rejects empty string", () => {
		expect(emailSchema.safeParse("").success).toBe(false);
	});

	it("rejects string without @", () => {
		expect(emailSchema.safeParse("userexample.com").success).toBe(false);
	});

	it("rejects string without domain", () => {
		expect(emailSchema.safeParse("user@").success).toBe(false);
	});
});
