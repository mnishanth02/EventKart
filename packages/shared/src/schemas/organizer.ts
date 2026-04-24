import { z } from "zod/v4";
import { emailSchema } from "./email.js";
import { phoneSchema } from "./phone.js";

/**
 * Organizer registration request — submitted when an organizer-role user
 * creates their organizer profile for the first time.
 *
 * City is a free-form string (Coimbatore-only for V1, but no enum lock).
 */
export const organizerRegistrationSchema = z.object({
	businessName: z
		.string()
		.min(2, "Business name must be at least 2 characters")
		.max(200, "Business name must not exceed 200 characters")
		.trim(),
	contactName: z
		.string()
		.min(2, "Contact name must be at least 2 characters")
		.max(100, "Contact name must not exceed 100 characters")
		.trim(),
	contactEmail: emailSchema,
	contactPhone: phoneSchema,
	city: z
		.string()
		.min(2, "City must be at least 2 characters")
		.max(100, "City must not exceed 100 characters")
		.trim(),
	description: z
		.string()
		.max(2000, "Description must not exceed 2000 characters")
		.trim()
		.optional(),
	website: z
		.string()
		.url("Must be a valid URL")
		.max(500, "Website URL must not exceed 500 characters")
		.optional(),
});

export type OrganizerRegistrationInput = z.input<
	typeof organizerRegistrationSchema
>;
export type OrganizerRegistration = z.output<
	typeof organizerRegistrationSchema
>;

/** Public-safe organizer data (excludes internal fields). */
export const organizerProfileSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	businessName: z.string(),
	contactName: z.string(),
	contactEmail: z.string(),
	contactPhone: z.string(),
	city: z.string(),
	description: z.string().nullable(),
	website: z.string().nullable(),
	verificationStatus: z.string(),
	isVerified: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type OrganizerProfile = z.infer<typeof organizerProfileSchema>;
