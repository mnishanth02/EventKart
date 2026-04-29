export const ORGANIZER_SLUG_MIN_LENGTH = 1;
export const ORGANIZER_SLUG_MAX_LENGTH = 80;
export const ORGANIZER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ORGANIZER_SLUG_FALLBACK = "organizer";

/**
 * Slugs that organizers cannot claim. These are reserved for product
 * routes, marketing surfaces, or internal subdomains.
 */
export const RESERVED_ORGANIZER_SLUGS = [
	"admin",
	"api",
	"www",
	"app",
	"help",
	"support",
	"organizer",
	"organizers",
	"event",
	"events",
	"search",
	"explore",
	"dashboard",
	"settings",
	"profile",
	"login",
	"logout",
	"register",
	"signup",
] as const;

export type ReservedOrganizerSlug = (typeof RESERVED_ORGANIZER_SLUGS)[number];
