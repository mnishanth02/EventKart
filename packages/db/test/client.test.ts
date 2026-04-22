import { describe, expect, it } from "vitest";

import { createDatabase } from "../src/client.js";

describe("client", () => {
	it("exports createDatabase function", () => {
		expect(typeof createDatabase).toBe("function");
	});
});
