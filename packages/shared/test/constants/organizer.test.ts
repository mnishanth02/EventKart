import { describe, expect, it } from "vitest";
import { RESERVED_ORGANIZER_SLUGS } from "../../src/constants/organizer";

describe("RESERVED_ORGANIZER_SLUGS", () => {
	it("includes the public slugs reserved by the Phase 2 plan", () => {
		expect(RESERVED_ORGANIZER_SLUGS).toEqual(
			expect.arrayContaining([
				"admin",
				"api",
				"auth",
				"login",
				"logout",
				"health",
				"ready",
				"events",
				"org",
				"organizers",
				"my",
				"book",
				"lookup-booking",
			]),
		);
	});
});
