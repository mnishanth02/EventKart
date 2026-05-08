/**
 * Test user constants matching the seeded users in the database
 * As defined in docs/local-ui-validation-guide.md Section 5
 */

export const TEST_USERS = {
	admin: {
		phone: "9999900001",
		fullPhone: "+919999900001",
		role: "admin" as const,
		displayName: "Admin User",
	},
	organizer: {
		phone: "9999900002",
		fullPhone: "+919999900002",
		role: "organizer" as const,
		displayName: "Organizer User",
	},
	participant: {
		phone: "9999900003",
		fullPhone: "+919999900003",
		role: "participant" as const,
		displayName: "Participant User",
	},
} as const;

export type UserRole = keyof typeof TEST_USERS;
