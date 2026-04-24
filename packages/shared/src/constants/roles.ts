import { z } from "zod/v4";

export const USER_ROLES = [
	"public",
	"participant",
	"organizer",
	"admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

/**
 * Numeric hierarchy levels for RBAC comparison.
 * Higher number = more permissions.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
	public: 0,
	participant: 1,
	organizer: 2,
	admin: 3,
} as const;

/**
 * Check if a user's role meets the minimum required role level.
 * Uses hierarchical comparison: admin > organizer > participant > public.
 */
export function hasMinimumRole(
	userRole: UserRole,
	minimumRole: UserRole,
): boolean {
	return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
