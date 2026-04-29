import { z } from "zod/v4";
import {
	ORGANIZER_SLUG_MAX_LENGTH,
	ORGANIZER_SLUG_MIN_LENGTH,
	ORGANIZER_SLUG_PATTERN,
} from "../constants/organizer.js";

/**
 * URL-safe organizer slug as exposed on public surfaces (e.g. the embedded
 * organizer summary on `/events/:slug` and the upcoming `/organizers/:slug`
 * profile route — I-2.3.1).
 *
 * Mirrors {@link import("./event-slug.js").eventSlugSchema}: branded for
 * compile-time discrimination from arbitrary strings, regex-validated to
 * the same `[a-z0-9-]` charset enforced by the slug generator and the
 * `organizers_slug_unique` DB index.
 */
export const organizerSlugSchema = z
	.string()
	.min(ORGANIZER_SLUG_MIN_LENGTH, "Organizer slug is required")
	.max(
		ORGANIZER_SLUG_MAX_LENGTH,
		`Organizer slug must be at most ${ORGANIZER_SLUG_MAX_LENGTH} characters`,
	)
	.regex(
		ORGANIZER_SLUG_PATTERN,
		"Organizer slug must contain lowercase letters, numbers, and single hyphens only",
	)
	.brand<"OrganizerSlug">();

export type OrganizerSlugInput = z.input<typeof organizerSlugSchema>;
export type OrganizerSlug = z.output<typeof organizerSlugSchema>;
