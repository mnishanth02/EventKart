import { z } from "zod/v4";

export const USER_ROLES = [
	"public",
	"participant",
	"organizer",
	"admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);
