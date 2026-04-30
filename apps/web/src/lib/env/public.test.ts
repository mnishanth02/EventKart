import { describe, expect, it } from "vitest";
import { stringBoolEnv } from "./public";

describe("stringBoolEnv", () => {
	it("returns false for undefined (default)", () => {
		expect(stringBoolEnv.parse(undefined)).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(stringBoolEnv.parse("")).toBe(false);
	});

	it("returns true for the string 'true'", () => {
		expect(stringBoolEnv.parse("true")).toBe(true);
	});

	it("returns true for the string 'TRUE' (case-insensitive)", () => {
		expect(stringBoolEnv.parse("TRUE")).toBe(true);
		expect(stringBoolEnv.parse("True")).toBe(true);
	});

	it("returns true for the string '1'", () => {
		expect(stringBoolEnv.parse("1")).toBe(true);
	});

	it("returns false for the string 'false' (NOT JS-truthy coerced)", () => {
		// Regression: z.coerce.boolean() would return true here, which would
		// silently enable opt-in feature flags configured with `=false`.
		expect(stringBoolEnv.parse("false")).toBe(false);
		expect(stringBoolEnv.parse("False")).toBe(false);
		expect(stringBoolEnv.parse("FALSE")).toBe(false);
	});

	it("returns false for the string '0'", () => {
		expect(stringBoolEnv.parse("0")).toBe(false);
	});

	it("returns false for unknown strings", () => {
		expect(stringBoolEnv.parse("yes")).toBe(false);
		expect(stringBoolEnv.parse("no")).toBe(false);
		expect(stringBoolEnv.parse("on")).toBe(false);
	});

	it("trims surrounding whitespace before matching", () => {
		expect(stringBoolEnv.parse("  true  ")).toBe(true);
		expect(stringBoolEnv.parse("\ttrue\n")).toBe(true);
		expect(stringBoolEnv.parse("  false  ")).toBe(false);
	});

	it("accepts native boolean values unchanged", () => {
		expect(stringBoolEnv.parse(true)).toBe(true);
		expect(stringBoolEnv.parse(false)).toBe(false);
	});
});
