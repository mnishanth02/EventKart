import { describe, expect, it } from "vitest";
import { isValidIndianPhone, normalizePhone } from "../../src/utils/phone";

describe("normalizePhone", () => {
	it.each([
		["9876543210", "+919876543210"],
		["+919876543210", "+919876543210"],
		["919876543210", "+919876543210"],
		["09876543210", "+919876543210"],
		["98765 43210", "+919876543210"],
		["98765-43210", "+919876543210"],
		["9876-543-210", "+919876543210"],
	])('normalizes "%s" to "%s"', (input, expected) => {
		expect(normalizePhone(input)).toBe(expected);
	});

	it("throws for 9 digits", () => {
		expect(() => normalizePhone("987654321")).toThrow();
	});

	it("throws for 13 digits", () => {
		expect(() => normalizePhone("9876543210123")).toThrow();
	});

	it("throws for number starting with 5", () => {
		expect(() => normalizePhone("5000000000")).toThrow();
	});

	it("throws for empty string", () => {
		expect(() => normalizePhone("")).toThrow();
	});

	it("throws for all letters", () => {
		expect(() => normalizePhone("abcdefghij")).toThrow();
	});
});

describe("isValidIndianPhone", () => {
	it("returns true for valid number", () => {
		expect(isValidIndianPhone("9876543210")).toBe(true);
	});

	it("returns false for invalid number", () => {
		expect(isValidIndianPhone("12345")).toBe(false);
	});
});
