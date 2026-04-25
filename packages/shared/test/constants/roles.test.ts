import { describe, expect, it } from "vitest";
import {
	hasMinimumRole,
	ROLE_HIERARCHY,
	USER_ROLES,
	type UserRole,
} from "../../src/constants/roles.js";

describe("ROLE_HIERARCHY", () => {
	it("assigns increasing levels: public < participant < organizer < admin", () => {
		expect(ROLE_HIERARCHY.public).toBeLessThan(ROLE_HIERARCHY.participant);
		expect(ROLE_HIERARCHY.participant).toBeLessThan(ROLE_HIERARCHY.organizer);
		expect(ROLE_HIERARCHY.organizer).toBeLessThan(ROLE_HIERARCHY.admin);
	});

	it("covers all USER_ROLES", () => {
		for (const role of USER_ROLES) {
			expect(ROLE_HIERARCHY[role]).toBeDefined();
		}
	});
});

describe("hasMinimumRole", () => {
	it("returns true when user role matches minimum", () => {
		expect(hasMinimumRole("participant", "participant")).toBe(true);
		expect(hasMinimumRole("organizer", "organizer")).toBe(true);
		expect(hasMinimumRole("admin", "admin")).toBe(true);
		expect(hasMinimumRole("public", "public")).toBe(true);
	});

	it("returns true when user role exceeds minimum (hierarchy)", () => {
		expect(hasMinimumRole("admin", "organizer")).toBe(true);
		expect(hasMinimumRole("admin", "participant")).toBe(true);
		expect(hasMinimumRole("admin", "public")).toBe(true);
		expect(hasMinimumRole("organizer", "participant")).toBe(true);
		expect(hasMinimumRole("organizer", "public")).toBe(true);
		expect(hasMinimumRole("participant", "public")).toBe(true);
	});

	it("returns false when user role is below minimum", () => {
		expect(hasMinimumRole("public", "participant")).toBe(false);
		expect(hasMinimumRole("public", "organizer")).toBe(false);
		expect(hasMinimumRole("public", "admin")).toBe(false);
		expect(hasMinimumRole("participant", "organizer")).toBe(false);
		expect(hasMinimumRole("participant", "admin")).toBe(false);
		expect(hasMinimumRole("organizer", "admin")).toBe(false);
	});

	it("validates all role combinations exhaustively", () => {
		const roles: UserRole[] = ["public", "participant", "organizer", "admin"];
		for (const userRole of roles) {
			for (const minRole of roles) {
				const result = hasMinimumRole(userRole, minRole);
				const expected = ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
				expect(result).toBe(expected);
			}
		}
	});
});
