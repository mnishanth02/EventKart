import { describe, expect, it } from "vitest";
import { phoneInputSchema, phoneSchema } from "../../src/schemas/phone";

describe("phoneInputSchema", () => {
	it.each([
		"6000000000",
		"7000000000",
		"8000000000",
		"9000000000",
	])("accepts 10-digit number starting with %s", (num) => {
		expect(phoneInputSchema.safeParse(num).success).toBe(true);
	});

	it("accepts with +91 prefix", () => {
		expect(phoneInputSchema.safeParse("+919876543210").success).toBe(true);
	});

	it("accepts with 0 prefix", () => {
		expect(phoneInputSchema.safeParse("09876543210").success).toBe(true);
	});

	it("accepts with spaces and dashes", () => {
		expect(phoneInputSchema.safeParse("98765 43210").success).toBe(true);
		expect(phoneInputSchema.safeParse("98765-43210").success).toBe(true);
		expect(phoneInputSchema.safeParse("9876-543-210").success).toBe(true);
	});

	it("rejects number starting with 0-5", () => {
		expect(phoneInputSchema.safeParse("5000000000").success).toBe(false);
		expect(phoneInputSchema.safeParse("1234567890").success).toBe(false);
	});

	it("rejects too short (9 digits)", () => {
		expect(phoneInputSchema.safeParse("987654321").success).toBe(false);
	});

	it("rejects too long (11+ digits without valid prefix)", () => {
		expect(phoneInputSchema.safeParse("98765432101").success).toBe(false);
	});

	it("rejects empty string", () => {
		expect(phoneInputSchema.safeParse("").success).toBe(false);
	});

	it("rejects non-numeric", () => {
		expect(phoneInputSchema.safeParse("abcdefghij").success).toBe(false);
	});
});

describe("phoneSchema", () => {
	it('transforms "9876543210" to "+919876543210"', () => {
		expect(phoneSchema.parse("9876543210")).toBe("+919876543210");
	});

	it('transforms "+919876543210" to "+919876543210"', () => {
		expect(phoneSchema.parse("+919876543210")).toBe("+919876543210");
	});

	it('transforms "09876543210" to "+919876543210"', () => {
		expect(phoneSchema.parse("09876543210")).toBe("+919876543210");
	});

	it('transforms "98765 43210" to "+919876543210"', () => {
		expect(phoneSchema.parse("98765 43210")).toBe("+919876543210");
	});

	it('transforms "98765-43210" to "+919876543210"', () => {
		expect(phoneSchema.parse("98765-43210")).toBe("+919876543210");
	});

	it("fails on invalid number", () => {
		expect(phoneSchema.safeParse("1234567890").success).toBe(false);
	});
});
